import { parseApiResponse } from '../utils/apiHelper';
const API_BASE_URL = '/api';

class MediaApi {
  async createMedia(metadata) {
    try {
      const response = await fetch(`${API_BASE_URL}/media`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          },
        body: JSON.stringify(metadata),
      });

      const data = await parseApiResponse(response, "Create Media");
      return {
        success: true,
        media: data.media || data,
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
          },
        body: JSON.stringify(updates),
      });

      const data = await parseApiResponse(response, "Update Media");
      return {
        success: true,
        media: data.media || data,
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
          },
      });

      const data = await parseApiResponse(response, "Publish Media");
      return {
        success: true,
        media: data.media || data,
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
          },
      });

      const data = await parseApiResponse(response, "Save Draft");
      return {
        success: true,
        media: data.media || data,
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
        });

      const data = await parseApiResponse(response, "Get Media Status");
      return {
        success: true,
        status: data.status || data,
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
        });

      await parseApiResponse(response, "Delete Media");
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
        });

      const data = await parseApiResponse(response, "Get Media By ID");
      return {
        success: true,
        media: data.media || data,
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
          }
      );

      const data = await parseApiResponse(response, "Get User Media");
      return {
        success: true,
        media: data.media || data,
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