# Remodel AI — Frontend Integration Guide

---

## Base URL

```
https://your-server.com/api/v1
```

---

## Authentication

Every request **must** include this header:

```
x-api-key: YOUR_SERVER_ACCESS_KEY
```

---

## Endpoints

---

### 1. Get S3 Upload URL

**GET** `/api/v1/storage/upload-url`

Get a pre-signed URL to upload an image directly to S3.

**Query Params**

| Param          | Required | Description                        |
|----------------|----------|------------------------------------|
| `filename`     | ✅        | e.g. `room.jpg`                    |
| `content_type` | ❌        | MIME type, default `image/jpeg`    |

**Response**

```json
{
  "upload_url": "https://s3.amazonaws.com/...",
  "method": "PUT",
  "headers": {
    "Content-Type": "image/jpeg"
  },
  "s3_key": "renovate-ai/1234-uuid.jpg",
  "public_url": "https://cdn.example.com/renovate-ai/1234-uuid.jpg",
  "expires_in": 300
}
```

**Flow:**
1. Call this endpoint → get `upload_url`
2. `PUT` image binary directly to `upload_url` with `Content-Type` header
3. After upload → use `public_url` as your image URL

---

### 2. Remodel Room

**POST** `/api/v1/process/remodel`

AI redesigns a room based on your text instruction.

**Request Body**

```json
{
  "prompt": "Make this a modern minimalist living room",
  "image_base64": "base64_encoded_image_string",
  "mime_type": "image/jpeg"
}
```

| Field           | Required | Description                               |
|-----------------|----------|-------------------------------------------|
| `prompt`        | ✅        | Design instruction                        |
| `image_base64`  | ✅        | Base64 encoded image                      |
| `mime_type`     | ❌        | Default `image/jpeg`                      |

**Response**

```json
{
  "result": "AI generated description or image data",
  "total_tokens": 512
}
```

---

### 3. Inpaint (Edit Specific Area)

**POST** `/api/v1/process/inpaint`

Modify a specific part of the image.

**Request Body** — same as Remodel

```json
{
  "prompt": "Replace the sofa with a red sectional",
  "image_base64": "base64_encoded_image_string",
  "mime_type": "image/jpeg"
}
```

**Response** — same as Remodel

---

### 4. Style Transfer

**POST** `/api/v1/process/style-transfer`

Apply an architectural style to the room.

**Request Body** — same as Remodel

```json
{
  "prompt": "Apply Scandinavian style",
  "image_base64": "base64_encoded_image_string",
  "mime_type": "image/jpeg"
}
```

**Response** — same as Remodel

---

### 5. Save to History

**POST** `/api/v1/history`

Save a before/after result to user history.

**Headers**

```
x-api-key: YOUR_SERVER_ACCESS_KEY
x-user-id: user_123          ← optional, defaults to "default_user"
```

**Request Body**

```json
{
  "beforeImageUrl": "https://cdn.example.com/before.jpg",
  "afterImageUrl": "https://cdn.example.com/after.jpg",
  "prompt": "Modern minimalist style",
  "category": "living-room",
  "isPublic": false
}
```

| Field            | Required | Description                               |
|------------------|----------|-------------------------------------------|
| `beforeImageUrl` | ✅        | Public URL of original image              |
| `afterImageUrl`  | ✅        | Public URL of AI result image             |
| `prompt`         | ✅        | Prompt used                               |
| `category`       | ❌        | Default `"general"`                       |
| `isPublic`       | ❌        | Show in public gallery? Default `false`   |

**Response**

```json
{
  "id": "uuid",
  "userId": "user_123",
  "beforeImageUrl": "...",
  "afterImageUrl": "...",
  "prompt": "...",
  "category": "living-room",
  "isPublic": false,
  "createdAt": "2026-06-04T10:00:00.000Z"
}
```

---

### 6. Get User History

**GET** `/api/v1/history`

**Headers**

```
x-api-key: YOUR_SERVER_ACCESS_KEY
x-user-id: user_123
```

**Response** — Array of history records (latest first)

```json
[
  {
    "id": "uuid",
    "userId": "user_123",
    "beforeImageUrl": "...",
    "afterImageUrl": "...",
    "prompt": "...",
    "category": "living-room",
    "isPublic": false,
    "createdAt": "..."
  }
]
```

---

### 7. Public Gallery

**GET** `/api/v1/gallery/public`

Returns all public results from all users.

**Response** — same structure as history array

---

## Error Responses

| HTTP Code | Code              | Meaning                          |
|-----------|-------------------|----------------------------------|
| `400`     | `MISSING_PARAM`   | Required query param missing     |
| `400`     | `MISSING_FIELDS`  | Required body fields missing     |
| `401`     | `AUTH_FAILED`     | Wrong or missing `x-api-key`     |
| `500`     | `STORAGE_ERROR`   | S3 pre-signed URL failed         |
| `500`     | `AI_PROXY_ERROR`  | Gemini AI call failed            |

---

## Quick Integration Flow (Frontend)

```
1. GET /storage/upload-url?filename=room.jpg
        ↓
2. PUT <upload_url>  ← raw image binary, Content-Type: image/jpeg
        ↓
3. POST /process/remodel  ← send image as base64 + prompt
        ↓
4. Receive result
        ↓
5. POST /history  ← save before/after URLs + prompt
```

---

## Environment Variables Needed on Server

| Variable            | Purpose                        |
|---------------------|--------------------------------|
| `SERVER_ACCESS_KEY` | Auth key for all requests      |
| `RENOVATEAI_API_KEY`| Google AI Studio key (Gemini)  |
| `S3_ACCESS_KEY`     | AWS S3 access key              |
| `S3_SECRET_KEY`     | AWS S3 secret key              |
| `S3_BUCKET`         | S3 bucket name                 |
| `S3_REGION`         | AWS region (default ap-south-1)|
| `CLOUDFRONT_URL`    | CDN base URL for public images |
