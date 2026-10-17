import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Upload, Image, Video, Type, MessageSquare, ChevronRight, Check } from 'lucide-react';

const UploadStudio = () => {
  const navigate = useNavigate();
  
  // State machine
  const [step, setStep] = useState('select'); // select, edit, details, publish, processing, success
  const [selectedType, setSelectedType] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [locationContext, setLocationContext] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingState, setProcessingState] = useState('');
  
  // Upload session
  const [sessionId, setSessionId] = useState(null);
  
  // Refs
  const fileInputRef = useRef(null);
  
  // ═════════════════════════════════════════════════════════
  // STEP 1: SELECT CONTENT TYPE
  // ═════════════════════════════════════════════════════════
  
  const contentTypes = [
    { id: 'video', label: 'Video', icon: Video, color: '#FF6B6B', description: '15-60 seconds' },
    { id: 'photo', label: 'Photo', icon: Image, color: '#4ECDC4', description: 'Single image' },
    { id: 'carousel', label: 'Carousel', icon: Image, color: '#45B7D1', description: 'Multiple images' },
    { id: 'text', label: 'Text', icon: Type, color: '#FFD93D', description: 'Share your thoughts' },
    { id: 'discussion', label: 'Discussion', icon: MessageSquare, color: '#7F77DD', description: 'Ask the community' },
  ];
  
  const handleSelectType = (type) => {
    setSelectedType(type);
    if (type === 'text' || type === 'discussion') {
      setStep('details');
    } else {
      fileInputRef.current?.click();
    }
  };
  
  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    setSelectedFiles(files);
    setStep('edit');
    
    // Start upload session
    await createUploadSession(files[0]);
  };
  
  const createUploadSession = async (file) => {
    try {
      const response = await fetch('/api/uploads/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          mediaType: file.type,
          fileName: file.name,
          fileSize: file.size
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setSessionId(result.data.sessionId);
        await uploadFile(file, result.data.uploadUrl);
      } else {
        throw new Error(result.error.message);
      }
    } catch (error) {
      console.error('Upload session error:', error);
      alert('Failed to start upload. Please try again.');
    }
  };
  
  const uploadFile = async (file, uploadUrl) => {
    setStep('processing');
    setProcessingState('Uploading...');
    
    try {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (e) => {
        const percent = Math.round((e.loaded / e.total) * 100);
        setUploadProgress(percent);
      });
      
      xhr.addEventListener('load', async () => {
        if (xhr.status === 200) {
          setProcessingState('Processing...');
          await completeUpload();
        } else {
          throw new Error('Upload failed');
        }
      });
      
      xhr.addEventListener('error', () => {
        throw new Error('Upload failed');
      });
      
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    } catch (error) {
      console.error('Upload error:', error);
      setStep('select');
      alert('Upload failed. Please try again.');
    }
  };
  
  const completeUpload = async () => {
    try {
      const response = await fetch(`/api/uploads/session/${sessionId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          processingMetadata: {
            duration: 30, // Mock - extract from video
            dimensions: { width: 1080, height: 1920 },
            thumbnailUrl: 'https://cdn.drandee.app/thumb.jpg'
          }
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setStep('details');
      } else {
        throw new Error(result.error.message);
      }
    } catch (error) {
      console.error('Complete upload error:', error);
      setStep('select');
      alert('Processing failed. Please try again.');
    }
  };
  
  // ═════════════════════════════════════════════════════════
  // STEP 3: PUBLISH
  // ═════════════════════════════════════════════════════════
  
  const handlePublish = async () => {
    setStep('processing');
    setProcessingState('Publishing...');
    
    try {
      const response = await fetch('/api/uploads/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          sessionId,
          type: selectedType,
          caption,
          hashtags: extractHashtags(caption),
          visibility,
          locationContext
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setStep('success');
        setTimeout(() => {
          navigate('/home');
        }, 2000);
      } else {
        throw new Error(result.error.message);
      }
    } catch (error) {
      console.error('Publish error:', error);
      setStep('details');
      alert('Publish failed. Please try again.');
    }
  };
  
  const extractHashtags = (text) => {
    const matches = text.match(/#[\w]+/g);
    return matches || [];
  };
  
  // ═════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════
  
  return (
    <div style={S.container}>
      {/* Header */}
      <div style={S.header}>
        <button onClick={() => navigate(-1)} style={S.iconBtn}>
          <X size={24} color="#fff" />
        </button>
        <span style={S.title}>Create</span>
        <div style={{ width: 24 }} />
      </div>
      
      {/* Step 1: Select Type */}
      {step === 'select' && (
        <div style={S.content}>
          <h2 style={S.sectionTitle}>What do you want to create?</h2>
          
          <div style={S.typeGrid}>
            {contentTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => handleSelectType(type.id)}
                style={{
                  ...S.typeCard,
                  border: `1px solid ${type.color}40`
                }}
              >
                <div style={{ ...S.typeIcon, background: `${type.color}20` }}>
                  <type.icon size={28} color={type.color} />
                </div>
                <span style={S.typeLabel}>{type.label}</span>
                <span style={S.typeDesc}>{type.description}</span>
              </button>
            ))}
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,image/*"
            multiple={selectedType === 'carousel'}
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>
      )}
      
      {/* Step 2: Processing */}
      {(step === 'processing' || step === 'edit') && (
        <div style={S.content}>
          <div style={S.progressWrap}>
            <div style={S.progressTrack}>
              <div style={{ ...S.progressFill, width: `${uploadProgress}%` }} />
            </div>
            <span style={S.progressText}>{processingState} {uploadProgress}%</span>
          </div>
        </div>
      )}
      
      {/* Step 3: Details */}
      {step === 'details' && (
        <div style={S.content}>
          <h2 style={S.sectionTitle}>Add details</h2>
          
          {/* Caption */}
          <div style={S.field}>
            <label style={S.label}>Caption</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write a caption..."
              style={S.textarea}
              rows={4}
            />
          </div>
          
          {/* Visibility */}
          <div style={S.field}>
            <label style={S.label}>Visibility</label>
            <div style={S.visibilityOptions}>
              {['public', 'followers', 'private'].map((v) => (
                <button
                  key={v}
                  onClick={() => setVisibility(v)}
                  style={{
                    ...S.visibilityBtn,
                    background: visibility === v ? '#7F77DD' : '#1a1a1a',
                    borderColor: visibility === v ? '#7F77DD' : '#252525'
                  }}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>
          
          {/* Location Context */}
          <div style={S.field}>
            <label style={S.label}>Location (optional)</label>
            <button
              onClick={() => setLocationContext({ city: 'Chennai', region: 'Tamil Nadu', country: 'IN' })}
              style={S.locationBtn}
            >
              {locationContext ? '📍 Chennai, Tamil Nadu' : '+ Add location'}
            </button>
          </div>
          
          {/* Publish Button */}
          <button
            onClick={handlePublish}
            style={S.publishBtn}
          >
            Publish
            <ChevronRight size={20} />
          </button>
        </div>
      )}
      
      {/* Step 4: Success */}
      {step === 'success' && (
        <div style={S.successWrap}>
          <div style={S.successIcon}>
            <Check size={48} color="#7F77DD" />
          </div>
          <h2 style={S.successTitle}>Published successfully!</h2>
          <p style={S.successText}>Your post is now ready for discovery</p>
        </div>
      )}
    </div>
  );
};

// ═════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════

const S = {
  container: {
    minHeight: '100dvh',
    background: '#FFFFFF',
    color: '#111111',
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    height: 56,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    borderBottom: '0.5px solid #E8E8EC'
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    padding: 8,
    cursor: 'pointer'
  },
  title: {
    fontSize: 18,
    fontWeight: 600
  },
  content: {
    flex: 1,
    padding: 24
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 24,
    textAlign: 'center'
  },
  typeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 16
  },
  typeCard: {
    background: '#F7F7F9',
    borderRadius: 16,
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    cursor: 'pointer',
    transition: 'transform 0.2s',
    border: '1px solid'
  },
  typeIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  typeLabel: {
    fontSize: 16,
    fontWeight: 600
  },
  typeDesc: {
    fontSize: 12,
    color: '#666666'
  },
  progressWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    marginTop: 80
  },
  progressTrack: {
    width: '100%',
    height: 4,
    background: '#E8E8EC',
    borderRadius: 2,
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    background: '#7F77DD',
    transition: 'width 0.3s'
  },
  progressText: {
    fontSize: 14,
    color: '#666666'
  },
  field: {
    marginBottom: 24
  },
  label: {
    display: 'block',
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 8,
    color: '#666666'
  },
  textarea: {
    width: '100%',
    background: '#F7F7F9',
    border: '0.5px solid #E8E8EC',
    borderRadius: 12,
    padding: 16,
    color: '#111111',
    fontSize: 16,
    resize: 'none',
    fontFamily: 'inherit'
  },
  visibilityOptions: {
    display: 'flex',
    gap: 8
  },
  visibilityBtn: {
    flex: 1,
    padding: '12px 16px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    border: '0.5px solid',
    background: '#F7F7F9',
    color: '#111111',
    cursor: 'pointer'
  },
  locationBtn: {
    width: '100%',
    padding: '12px 16px',
    background: '#F7F7F9',
    border: '0.5px solid #E8E8EC',
    borderRadius: 12,
    color: '#111111',
    fontSize: 14,
    textAlign: 'left',
    cursor: 'pointer'
  },
  publishBtn: {
    width: '100%',
    padding: '16px 24px',
    background: '#7F77DD',
    border: 'none',
    borderRadius: 14,
    color: '#fff',
    fontSize: 16,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    cursor: 'pointer',
    marginTop: 24
  },
  successWrap: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    background: '#7F77DD20',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 700
  },
  successText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center'
  }
};

export default UploadStudio;