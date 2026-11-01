export async function parseApiResponse(response, context = "Request") {
  const contentType = response.headers.get("content-type") || "";
  const rawText = await response.text();
  let data = null;

  if (contentType.includes("application/json")) {
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch (error) {
      console.error(`Invalid JSON response during ${context}:`, rawText);
      throw new Error("Server returned invalid JSON");
    }
  } else {
    console.error(`Non-JSON server response during ${context}:`, response.status, rawText);
    throw new Error(
      response.ok
        ? "Server returned an unexpected response"
        : "Unable to connect to the server. Please check that the backend is running."
    );
  }

  if (!response.ok) {
    let errorMessage = `${context} failed. Please try again.`;
    
    if (data) {
      if (typeof data.error === 'string') {
        errorMessage = data.error;
      } else if (data.error && typeof data.error.message === 'string') {
        errorMessage = data.error.message;
      } else if (typeof data.message === 'string') {
        errorMessage = data.message;
      } else if (typeof data.details === 'string') {
        errorMessage = data.details;
      } else if (typeof data === 'string') {
        errorMessage = data;
      } else if (data.error) {
        errorMessage = String(data.error);
        if (errorMessage === '[object Object]') {
          errorMessage = 'An internal server error occurred.';
        }
      }
    }

    throw new Error(errorMessage);
  }

  return data;
}
