# Server Integration Details (Renovate AI Mobile App)

This document provides the necessary details to integrate the Renovate AI manual app with the backend API.

## 1. Base URL
All API calls should use the following base URL:
`http://localhost:3000/api/v1` (Update to production URL once deployed)

## 2. Authentication
Requests MUST include the following headers:
- `x-api-key`: `YOUR_STRIPE_SECRET_KEY`
- `x-user-id`: (Optional for now) The unique Firebase UID of the user.

## 3. Endpoints

### 3.1 Storage
- **GET** `/storage/upload-url?filename=room.jpg`
    - Returns: `{ "upload_url": "...", "method": "PUT", "headers": { ... }, "fields": { ... } }`

### 3.2 AI Processing
The following endpoints proxy requests to Gemini AI:
- **POST** `/process/remodel`
- **POST** `/process/inpaint`
- **POST** `/process/style-transfer`
    - **Request Body**:
      ```json
      {
        "prompt": "Modernize this bedroom",
        "image_base64": "...",
        "mime_type": "image/jpeg"
      }
      ```
    - **Response**: `{ "result": "base64_string", "total_tokens": 123 }`

### 3.3 History & Gallery
- **GET** `/history`
    - Returns: List of history items for the current user.
- **POST** `/history`
    - **Request Body**:
      ```json
      {
        "beforeImageUrl": "...",
        "afterImageUrl": "...",
        "prompt": "...",
        "category": "bedroom",
        "isPublic": true/false
      }
      ```
- **GET** `/gallery/public`
    - Returns: List of all public history items.

## 4. Test Credentials
- **API Key**: `YOUR_STRIPE_SECRET_KEY`
- **User ID**: `test_user_789`
