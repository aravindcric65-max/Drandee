import { get, set, del } from 'idb-keyval';

export const saveDraft = async (mediaItems, settings) => {
  try {
    const draft = {
      timestamp: Date.now(),
      settings,
      mediaFiles: mediaItems.map(item => item.file)
    };
    await set('upload_draft', draft);
  } catch (error) {
    console.error('Failed to save draft:', error);
  }
};

export const loadDraft = async () => {
  try {
    const draft = await get('upload_draft');
    if (!draft) return null;
    
    // Check if draft is older than 24 hours
    if (Date.now() - draft.timestamp > 24 * 60 * 60 * 1000) {
      await clearDraft();
      return null;
    }
    
    // Recreate media items with object URLs
    const mediaItems = draft.mediaFiles.map(file => ({
      file,
      url: URL.createObjectURL(file),
      id: Math.random().toString(36).substring(7)
    }));
    
    return { mediaItems, settings: draft.settings };
  } catch (error) {
    console.error('Failed to load draft:', error);
    return null;
  }
};

export const clearDraft = async () => {
  try {
    await del('upload_draft');
  } catch (error) {
    console.error('Failed to clear draft:', error);
  }
};
