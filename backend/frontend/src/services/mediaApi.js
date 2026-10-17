const API_BASE_URL = '/api';

class MediaApi {
  async createMedia(metadata) {
    try {
      const response = await fetch(`${API_BASE_URL}/media`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(metadata),
      });

      if (!response.ok) {
        throw new Error('Failed to create media');
      }

      const data = await response.json();
      return {
        success: true,
        media: data.media,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async updateMedia(mediaId, updates) {
    try {
      const response = await fetch(`${API_BASE_URL}/media/${mediaId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update media');
      }

      const data = await response.json();
      return {
        success: true,
        media: data.media,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async publishMedia(mediaId) {
    try {
      const response = await fetch(`${API_BASE_URL}/media/${mediaId}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to publish media');
      }

      const data = await response.json();
      return {
        success: true,
        media: data.media,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async saveDraft(mediaId) {
    try {
      const response = await fetch(`${API_BASE_URL}/media/${mediaId}/draft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to save draft');
      }

      const data = await response.json();
      return {
        success: true,
        media: data.media,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getMediaStatus(mediaId) {
    try {
      const response = await fetch(`${API_BASE_URL}/media/${mediaId}/status`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get status');
      }

      const data = await response.json();
      return {
        success: true,
        status: data.status,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async deleteMedia(mediaId) {
    try {
      const response = await fetch(`${API_BASE_URL}/media/${mediaId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete media');
      }

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getMediaById(mediaId) {
    try {
      const response = await fetch(`${API_BASE_URL}/media/${mediaId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get media');
      }

      const data = await response.json();
      return {
        success: true,
        media: data.media,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getUserMedia(userId, page = 1, limit = 20) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/media/user/${userId}?page=${page}&limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get user media');
      }

      const data = await response.json();
      return {
        success: true,
        media: data.media,
        pagination: data.pagination,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export default new MediaApi();