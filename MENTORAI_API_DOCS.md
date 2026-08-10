# MentorAI API — Integration Guide

Base URL: `https://apps-model-server.mirdemy.com`

---

## Authentication

All endpoints are protected. Every request must include the `x-api-key` header.

```
x-api-key: YOUR_SERVER_ACCESS_KEY
```

> Stored in `.env` as `SERVER_ACCESS_KEY`. Never expose this key publicly.

---

## Endpoints Overview

| Endpoint | Method | Auth | Model | Description |
|---|---|---|---|---|
| `/api/mentorai/chat` | POST | ✅ | Proxy (Gemini) | Conversational AI tutor chat |
| `/api/mentorai/summarize` | POST | ✅ | Proxy (Gemini) | Summarize topics or notes |
| `/api/mentorai/study-plan` | POST | ✅ | Proxy (Gemini) | Generate a personalised study plan |
| `/api/mentorai/generate-image` | POST | ✅ | `gemini-2.5-flash-image` | Generate educational diagrams / illustrations |

---

## How the Two Models Work

### Text / Chat Endpoints (`/chat`, `/summarize`, `/study-plan`)
These endpoints use **AWS Bedrock — `openai.gpt-oss-120b-1:0`**, the same model used by SmartCloset chat. The server calls Bedrock directly — your Flutter app never touches AWS credentials.

### Image Generation Endpoint (`/generate-image`)
This endpoint calls **`gemini-2.5-flash-image`** directly via the Google Generative Language API. The server attaches the API key — your app only sends the prompt and an optional reference image.

---

## Request & Response

### Common Request Body

```json
{
  "prompt": "Your question, instruction, or topic"
}
```

### Image Generation Request Body

```json
{
  "prompt": "Draw a labelled diagram of the human heart",
  "image_base64": "optional_base64_reference_image",
  "mime_type": "image/jpeg"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `prompt` | String | ✅ Yes | The question, topic, or instruction for the AI |
| `image_base64` | String | ❌ Optional | Reference image in Base64 (only for `/generate-image`) |
| `mime_type` | String | ❌ Optional | MIME type of the reference image: `image/jpeg`, `image/png`, `image/webp` |

### Success Response (200)

```json
{
  "result": "AI response text or base64 image string",
  "total_tokens": 320
}
```

> For `/generate-image`: `result` is a **pure base64 string** of the generated image.  
> For all other endpoints: `result` is a **text string**.

### Error Responses

**Unauthorized (401):**
```json
{
  "error": "Unauthorized: Invalid or missing API key",
  "code": "AUTH_FAILED"
}
```

**Missing Field (400):**
```json
{
  "error": "prompt field is required",
  "code": "MISSING_FIELD"
}
```

**Safety Block (422):**
```json
{
  "error": "Blocked by safety filters",
  "code": "SAFETY_BLOCK"
}
```

**Server Error (500):**
```json
{
  "error": "Error description",
  "code": "MENTORAI_CHAT_ERROR | MENTORAI_SUMMARIZE_ERROR | MENTORAI_STUDYPLAN_ERROR | MENTORAI_IMAGE_ERROR"
}
```

---

## Error Codes Reference

| Code | HTTP Status | Description |
|---|---|---|
| `AUTH_FAILED` | 401 | Missing or invalid `x-api-key` header |
| `MISSING_FIELD` | 400 | `prompt` field not provided |
| `SAFETY_BLOCK` | 422 | Request blocked by Gemini safety filters |
| `MENTORAI_CHAT_ERROR` | 500 | Internal error in chat endpoint |
| `MENTORAI_SUMMARIZE_ERROR` | 500 | Internal error in summarize endpoint |
| `MENTORAI_STUDYPLAN_ERROR` | 500 | Internal error in study plan endpoint |
| `MENTORAI_IMAGE_ERROR` | 500 | Internal error in image generation endpoint |

---

## Test with cURL

**Chat:**
```bash
curl -X POST https://apps-model-server.mirdemy.com/api/mentorai/chat \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_SERVER_ACCESS_KEY" \
  -d '{"prompt": "Explain Newton'\''s second law of motion in simple terms"}'
```

**Summarize:**
```bash
curl -X POST https://apps-model-server.mirdemy.com/api/mentorai/summarize \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_SERVER_ACCESS_KEY" \
  -d '{"prompt": "Summarize the following notes: The mitochondria is the powerhouse of the cell..."}'
```

**Study Plan:**
```bash
curl -X POST https://apps-model-server.mirdemy.com/api/mentorai/study-plan \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_SERVER_ACCESS_KEY" \
  -d '{"prompt": "Create a 4-week study plan for IELTS preparation, 2 hours per day"}'
```

**Generate Image:**
```bash
curl -X POST https://apps-model-server.mirdemy.com/api/mentorai/generate-image \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_SERVER_ACCESS_KEY" \
  -d '{"prompt": "Draw a labelled diagram of the water cycle"}'
```

---

## Flutter Integration

### Environment Variable

Add to your Flutter `.env`:
```
MENTOR_AI_BASE_URL=https://apps-model-server.mirdemy.com
MENTOR_AI_ACCESS_KEY=YOUR_SERVER_ACCESS_KEY
```

### Full Flutter Service (`mentor_ai_service.dart`)

```dart
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;

class MentorAIService {
  static const String _baseUrl = 'https://apps-model-server.mirdemy.com';
  static const String _accessKey = 'YOUR_SERVER_ACCESS_KEY';

  static Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    'x-api-key': _accessKey,
  };

  // ── Chat ──────────────────────────────────────────────────────────────────

  /// Conversational AI tutor — POST /api/mentorai/chat
  static Future<Map<String, dynamic>> chat({
    required String prompt,
  }) async {
    return await _callText(endpoint: '/api/mentorai/chat', prompt: prompt);
  }

  // ── Summarize ─────────────────────────────────────────────────────────────

  /// Summarize a topic or notes — POST /api/mentorai/summarize
  /// Include the content to summarize inside [prompt].
  static Future<Map<String, dynamic>> summarize({
    required String prompt,
  }) async {
    return await _callText(endpoint: '/api/mentorai/summarize', prompt: prompt);
  }

  // ── Study Plan ────────────────────────────────────────────────────────────

  /// Generate a personalised study plan — POST /api/mentorai/study-plan
  /// Include subject, duration, and goals inside [prompt].
  static Future<Map<String, dynamic>> generateStudyPlan({
    required String prompt,
  }) async {
    return await _callText(endpoint: '/api/mentorai/study-plan', prompt: prompt);
  }

  // ── Image Generation ──────────────────────────────────────────────────────

  /// Generate an educational diagram or illustration — POST /api/mentorai/generate-image
  /// [referenceImage] is optional — pass it to guide the generation with a sketch or existing image.
  /// Returns [result] as a pure base64 string of the generated image.
  static Future<Map<String, dynamic>> generateImage({
    required String prompt,
    File? referenceImage,
  }) async {
    final Map<String, dynamic> body = {'prompt': prompt};

    if (referenceImage != null) {
      final bytes = await referenceImage.readAsBytes();
      body['image_base64'] = base64Encode(bytes);
      body['mime_type'] = _getMimeType(referenceImage.path);
    }

    return await _post(endpoint: '/api/mentorai/generate-image', body: body);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  static Future<Map<String, dynamic>> _callText({
    required String endpoint,
    required String prompt,
  }) async {
    return await _post(endpoint: endpoint, body: {'prompt': prompt});
  }

  static Future<Map<String, dynamic>> _post({
    required String endpoint,
    required Map<String, dynamic> body,
  }) async {
    final response = await http.post(
      Uri.parse('$_baseUrl$endpoint'),
      headers: _headers,
      body: jsonEncode(body),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return {
        'result': data['result'] ?? '',
        'total_tokens': data['total_tokens'] ?? 0,
      };
    } else if (response.statusCode == 401) {
      throw Exception('Unauthorized: Invalid API key');
    } else if (response.statusCode == 422) {
      throw Exception('Blocked by safety filters');
    } else {
      final data = jsonDecode(response.body);
      throw Exception('API Error [${data['code']}]: ${data['error']}');
    }
  }

  static String _getMimeType(String path) {
    if (path.endsWith('.png'))  return 'image/png';
    if (path.endsWith('.webp')) return 'image/webp';
    return 'image/jpeg';
  }
}
```

---

## Usage Examples

### Chat

```dart
final response = await MentorAIService.chat(
  prompt: 'Explain photosynthesis in simple terms',
);
print(response['result']);       // AI text response
print(response['total_tokens']); // tokens used
```

### Summarize

```dart
final response = await MentorAIService.summarize(
  prompt: 'Summarize this chapter: The French Revolution began in 1789...',
);
print(response['result']);
```

### Study Plan

```dart
final response = await MentorAIService.generateStudyPlan(
  prompt: 'Create a 30-day study plan for Python programming, beginner level, 1 hour per day',
);
print(response['result']);
```

### Generate Image

```dart
// Without reference image
final response = await MentorAIService.generateImage(
  prompt: 'Draw a labelled diagram of the solar system',
);

// With reference image (e.g. a sketch to refine)
final response = await MentorAIService.generateImage(
  prompt: 'Improve this diagram and add labels',
  referenceImage: File('/path/to/sketch.jpg'),
);

// Decode and display the generated image
import 'dart:convert';
import 'package:flutter/material.dart';

final Uint8List imageBytes = base64Decode(response['result']);
Image.memory(imageBytes);
```

---

## Displaying Generated Images in Flutter

The `/generate-image` endpoint returns a **pure base64 string** in `result`. Decode it directly:

```dart
import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';

Uint8List imageBytes = base64Decode(response['result']);

// Display
Image.memory(imageBytes)

// Save to file
final file = File('/path/to/save/image.png');
await file.writeAsBytes(imageBytes);
```

---

## Credit Deduction

Every response includes `total_tokens` (input + output tokens combined). Use this to deduct credits from the user's account.

```dart
int tokensUsed = response['total_tokens'];
// Deduct credits based on tokensUsed
```

---

## Models Used

| Model | Endpoints | Purpose |
|---|---|---|
| `openai.gpt-oss-120b-1:0` (AWS Bedrock) | `/chat`, `/summarize`, `/study-plan` | Text generation, tutoring, planning |
| `gemini-2.5-flash-image` | `/generate-image` | Educational image / diagram generation |

---

## Supported Image Formats (for reference image)

| Format | `mime_type` |
|---|---|
| JPEG / JPG | `image/jpeg` |
| PNG | `image/png` |
| WebP | `image/webp` |

---

## Security Notes

- All requests without a valid `x-api-key` return `401`
- The Gemini API key is never sent to or from the Flutter app — it lives only on the server
- Store `MENTOR_AI_ACCESS_KEY` securely using `flutter_dotenv` or `--dart-define` in production
- `MENTOR_AI_BASE_URL` in the Flutter `.env` can be updated anytime to point to a new server without code changes
