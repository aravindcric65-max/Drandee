import { parseApiResponse } from '../utils/apiHelper';

class ImageKitService {
  async getUploadSignature(fileName, fileType, fileSize) {
    try {
      const response = await fetch('/api/media/upload-signature', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          },
        body: JSON.stringify({
          fileName,
          fileType,
          fileSize,
        }),
      });

      const data = await parseApiResponse(response, "Upload Signature");
      return {
        success: true,
        signature: data.signature,
        expire: data.expire,
        uploadParams: data.uploadParams,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async uploadFile(file, signature, expire, uploadParams) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('publicId', uploadParams.publicId);
      formData.append('signature', signature);
      formData.append('expire', expire);

      const response = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await parseApiResponse(response, "ImageKit Upload");
      return {
        success: true,
        fileId: result.fileId,
        url: result.url,
        thumbnailUrl: result.thumbnailUrl,
        fileType: result.fileType,
        size: result.size,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async uploadVideo(file, metadata = {}) {
    // Step 1: Get signature
    const signatureResult = await this.getUploadSignature(
      file.name,
      file.type,
      file.size
    );

    if (!signatureResult.success) {
      return signatureResult;
    }

    // Step 2: Upload file
    const uploadResult = await this.uploadFile(
      file,
      signatureResult.signature,
      signatureResult.expire,
      signatureResult.uploadParams
    );

    if (!uploadResult.success) {
      return uploadResult;
    }

    // Step 3: Save metadata to backend
    const metadataResult = await this.saveMetadata({
      mediaId: uploadResult.fileId,
      videoUrl: uploadResult.url,
      ...metadata,
    });

    return {
      success: true,
      ...uploadResult,
      metadata: metadataResult,
    };
  }

  async saveMetadata(metadata) {
    try {
      const response = await fetch('/api/media', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          },
        body: JSON.stringify(metadata),
      });

      const data = await parseApiResponse(response, "Save Metadata");
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

  getUrl(url, transformations = []) {
    // ImageKit URL transformation
    const ikParams = transformations
      .map((t) => `${t.key}-${t.value}`)
      .join(',');

    if (url.includes('?')) {
      return `${url}&ik-sdk-version=1&tr=${ikParams}`;
    }
    return `${url}?ik-sdk-version=1&tr=${ikParams}`;
  }
}

export default new ImageKitService();