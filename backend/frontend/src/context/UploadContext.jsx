import React, { createContext, useContext, useState, useCallback } from 'react';

export const UploadContext = createContext({
  uploads: [],
  startUpload: async () => {},
  clearUpload: () => {}
});

export const useUpload = () => useContext(UploadContext);

export const UploadProvider = ({ children }) => {
  const [uploads, setUploads] = useState([]); // Array of { id, progress, stage, error }

  const startUpload = useCallback(async (file, settings, token, postType = 'video') => {
    const uploadId = Date.now().toString();
    setUploads(prev => [...prev, { id: uploadId, progress: 0, stage: 'preparing', error: null }]);

    try {
      // 1. Create session
      const sessionRes = await fetch('/api/upload/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          mediaType: file.type || (file.name?.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg'),
          fileName: file.name || 'upload.mp4',
          fileSize: file.size || 0
        })
      });

      if (sessionRes.status === 401) {
        throw new Error('Authentication expired. Please log in again.');
      }

      const sessionData = await sessionRes.json();
      if (!sessionData.success) throw new Error(sessionData.error?.message || 'Failed to create session');

      const { sessionId } = sessionData.data;

      // 2. Upload file in chunks
      const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      let storageUrl = null;

      setUploads(prev => prev.map(u => u.id === uploadId ? { ...u, stage: 'uploading' } : u));

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('chunkIndex', i);
        formData.append('totalChunks', totalChunks);
        formData.append('fileName', file.name || 'upload.mp4');

        // Retry logic for each chunk
        let retries = 3;
        let chunkSuccess = false;
        while (retries > 0 && !chunkSuccess) {
          try {
            const chunkRes = await fetch(`/api/upload/chunk/${sessionId}`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`
              },
              body: formData
            });

            if (!chunkRes.ok) throw new Error(`Chunk ${i} failed`);
            const chunkData = await chunkRes.json();
            
            if (chunkData.data?.completed) {
              storageUrl = chunkData.data.storageUrl;
            }
            
            chunkSuccess = true;
            const progress = Math.round(((i + 1) / totalChunks) * 100);
            setUploads(prev => prev.map(u => u.id === uploadId ? { ...u, progress } : u));
          } catch (err) {
            retries--;
            if (retries === 0) throw err;
            await new Promise(r => setTimeout(r, 2000)); // Wait 2s before retry
          }
        }
      }

      // 3. Dispatch to worker queue (by hitting /session/complete)
      await fetch(`/api/upload/session/${sessionId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          storageUrl,
          processingMetadata: { thumbnailUrl: settings.thumbnail_url || null }
        })
      });
      
      setUploads(prev => prev.map(u => u.id === uploadId ? { ...u, stage: 'processing' } : u));
      
      // 4. Poll for status until 'ready'
      let isReady = false;
      while (!isReady) {
        await new Promise(r => setTimeout(r, 2000)); // Poll every 2 seconds
        
        const statusRes = await fetch(`/api/upload/session/${sessionId}/status`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData.data?.status === 'ready') {
            isReady = true;
          } else if (statusData.data?.status === 'failed') {
            throw new Error(statusData.data.error_message || 'Video processing failed');
          }
        }
      }

      // 5. Create post
      const postRes = await fetch('/api/upload/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sessionId,
          type: postType,
          caption: settings.caption,
          hashtags: settings.hashtags || [],
          visibility: settings.privacy || 'public',
        })
      });

      const postData = await postRes.json();
      if (!postData.success) throw new Error(postData.error?.message || 'Failed to create post');

      // Dispatch global event for live feed update
      if (postData.data) {
        window.dispatchEvent(new CustomEvent('new_post_published', { detail: postData.data }));
      }

      setUploads(prev => prev.map(u => u.id === uploadId ? { ...u, stage: 'completed' } : u));
      
      // Auto-remove completed upload after 5 seconds
      setTimeout(() => {
        setUploads(prev => prev.filter(u => u.id !== uploadId));
      }, 5000);

    } catch (err) {
      console.error('Background Upload Error:', err);
      setUploads(prev => prev.map(u => u.id === uploadId ? { ...u, error: err.message || 'Upload failed', stage: 'failed' } : u));
    }
  }, []);

  const clearUpload = useCallback((id) => {
    setUploads(prev => prev.filter(u => u.id !== id));
  }, []);

  return (
    <UploadContext.Provider value={{ uploads, startUpload, clearUpload }}>
      {children}
    </UploadContext.Provider>
  );
};
