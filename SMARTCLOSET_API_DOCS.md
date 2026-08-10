# SmartCloset API — Integration Guide

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

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/fashion-chat` | POST | ✅ | Fashion styling chat (text) |
| `/virtual-tryon` | POST | ✅ | Virtual try-on (image generation) |
| `/outfit-combo` | POST | ✅ | Outfit combinations (image generation) |
| `/api/smartcloset/fashion-chat` | POST | ✅ | Same as above (prefixed) |
| `/api/smartcloset/virtual-tryon` | POST | ✅ | Same as above (prefixed) |
| `/api/smartcloset/outfit-combo` | POST | ✅ | Same as above (prefixed) |
| `/api/gemini/chat` | POST | ✅ | **Proxy** — fashion chat for Flutter app |
| `/api/gemini/image` | POST | ✅ | **Proxy** — image generation for Flutter app |

---

## Proxy Endpoints (Flutter App)

These are the endpoints consumed by the SmartCloset Flutter app after the Gemini proxy migration. The app no longer calls Google's API directly — all requests go through this server.

### POST `/api/gemini/chat`
**Flutter file:** `gemini_service.dart`  
**Model:** `gemini-2.5-flash`  
**Use:** Text-based fashion styling chat with the "Style Guru" AI

### POST `/api/gemini/image`
**Flutter files:** `virtualtryon.dart`, `outfitcombopage.dart`  
**Model:** `gemini-2.5-flash-image`  
**Use:** Image generation — virtual try-on and outfit combinations

> The proxy endpoints accept the exact same payloads as the direct SmartCloset endpoints. Only the URL changes in the Flutter app — no payload modifications needed.

---

## Request Body

```json
{
  "prompt": "Your fashion query or instruction",
  "image_base64": "base64_encoded_image_string",
  "mime_type": "image/jpeg",
  "image_base64_2": "base64_encoded_second_image_string",
  "mime_type_2": "image/jpeg"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `prompt` | String | ✅ Yes | Question or instruction for the AI |
| `image_base64` | String | ❌ Optional | First image in Base64 (person photo for try-on / shirt for combo) |
| `mime_type` | String | ❌ Optional | MIME type of first image: `image/jpeg`, `image/png`, `image/webp` |
| `image_base64_2` | String | ❌ Optional | Second image in Base64 (clothing item for try-on / pant for combo) |
| `mime_type_2` | String | ❌ Optional | MIME type of second image |

> `image_base64` and `image_base64_2` are optional at the API level but practically required for `/virtual-tryon`, `/outfit-combo`, and `/api/gemini/image` to produce meaningful results.

---

## Response

**Success (200):**
```json
{
  "result": "AI generated response text or base64 image string",
  "total_tokens": 450
}
```

> For image endpoints (`/virtual-tryon`, `/outfit-combo`, `/api/gemini/image`): `result` is a **pure base64 string** of the generated image.  
> For chat endpoints (`/fashion-chat`, `/api/gemini/chat`): `result` is a **text response**.

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
  "code": "SMARTCLOSET_CHAT_ERROR | SMARTCLOSET_TRYON_ERROR | SMARTCLOSET_COMBO_ERROR | SMARTCLOSET_IMAGE_ERROR"
}
```

---

## Error Codes Reference

| Code | HTTP Status | Description |
|---|---|---|
| `AUTH_FAILED` | 401 | Missing or invalid `x-api-key` header |
| `MISSING_FIELD` | 400 | `prompt` field not provided |
| `SAFETY_BLOCK` | 422 | Request blocked by Gemini safety filters |
| `SMARTCLOSET_CHAT_ERROR` | 500 | Internal error in fashion chat |
| `SMARTCLOSET_TRYON_ERROR` | 500 | Internal error in virtual try-on |
| `SMARTCLOSET_COMBO_ERROR` | 500 | Internal error in outfit combo |
| `SMARTCLOSET_IMAGE_ERROR` | 500 | Internal error in `/api/gemini/image` proxy |

---

## Test with cURL

**Fashion Chat:**
```bash
curl -X POST https://apps-model-server.mirdemy.com/api/gemini/chat \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_SERVER_ACCESS_KEY" \
  -d '{"prompt": "What colors go well with navy blue?"}'
```

**Virtual Try-On / Outfit Combo:**
```bash
curl -X POST https://apps-model-server.mirdemy.com/api/gemini/image \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_SERVER_ACCESS_KEY" \
  -d '{
    "prompt": "Show how this shirt looks on me",
    "image_base64": "base64_person_photo_here",
    "mime_type": "image/jpeg",
    "image_base64_2": "base64_clothing_item_here",
    "mime_type_2": "image/jpeg"
  }'
```

---

## Flutter Migration

### What Changed

| | Before (Direct) | After (Proxy) |
|---|---|---|
| Chat URL | `generativelanguage.googleapis.com/...` | `{GEMINI_PROXY_BASE_URL}/api/gemini/chat` |
| Image URL | `generativelanguage.googleapis.com/...` | `{GEMINI_PROXY_BASE_URL}/api/gemini/image` |
| API Key header | `x-goog-api-key` sent from app | Removed — server attaches it |
| Auth header | None | `x-api-key: SERVER_ACCESS_KEY` |
| Request payload | Same | Same — no changes |

### Environment Variable

Add to your Flutter `.env`:
```
GEMINI_PROXY_BASE_URL=https://apps-model-server.mirdemy.com
```

### Updated `gemini_service.dart`

```dart
// Fashion chat — POST /api/gemini/chat
final response = await http.post(
  Uri.parse('$geminiProxyBaseUrl/api/gemini/chat'),
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': serverAccessKey,   // replaces x-goog-api-key
  },
  body: jsonEncode({'prompt': prompt}),
);
```

### Updated `virtualtryon.dart` and `outfitcombopage.dart`

```dart
// Image generation — POST /api/gemini/image
final response = await http.post(
  Uri.parse('$geminiProxyBaseUrl/api/gemini/image'),
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': serverAccessKey,   // replaces x-goog-api-key
  },
  body: jsonEncode({
    'prompt': prompt,
    'image_base64': base64Image1,
    'mime_type': mimeType1,
    'image_base64_2': base64Image2,
    'mime_type_2': mimeType2,
  }),
);
```

---

## Full Flutter Service (`smartcloset_service.dart`)

```dart
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;

class SmartClosetService {
  static const String _baseUrl = 'https://apps-model-server.mirdemy.com';
  static const String _accessKey = 'YOUR_SERVER_ACCESS_KEY';

  /// Fashion Styling Chat — /api/gemini/chat
  static Future<Map<String, dynamic>> fashionChat({
    required String prompt,
  }) async {
    return await _call(
      endpoint: '/api/gemini/chat',
      prompt: prompt,
    );
  }

  /// Virtual Try-On — /api/gemini/image
  /// [personPhoto] = user's photo
  /// [clothingItem] = clothing item to try on
  static Future<Map<String, dynamic>> virtualTryOn({
    required String prompt,
    File? personPhoto,
    File? clothingItem,
  }) async {
    return await _call(
      endpoint: '/api/gemini/image',
      prompt: prompt,
      imageFile: personPhoto,
      imageFile2: clothingItem,
    );
  }

  /// Outfit Combinations — /api/gemini/image
  /// [shirt] = shirt image
  /// [pant]  = pant image
  static Future<Map<String, dynamic>> outfitCombo({
    required String prompt,
    File? shirt,
    File? pant,
  }) async {
    return await _call(
      endpoint: '/api/gemini/image',
      prompt: prompt,
      imageFile: shirt,
      imageFile2: pant,
    );
  }

  static Future<Map<String, dynamic>> _call({
    required String endpoint,
    required String prompt,
    File? imageFile,
    File? imageFile2,
  }) async {
    final Map<String, dynamic> body = {'prompt': prompt};

    if (imageFile != null) {
      final bytes = await imageFile.readAsBytes();
      body['image_base64'] = base64Encode(bytes);
      body['mime_type'] = _getMimeType(imageFile.path);
    }

    if (imageFile2 != null) {
      final bytes = await imageFile2.readAsBytes();
      body['image_base64_2'] = base64Encode(bytes);
      body['mime_type_2'] = _getMimeType(imageFile2.path);
    }

    final response = await http.post(
      Uri.parse('$_baseUrl$endpoint'),
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': _accessKey,
      },
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

## Displaying Generated Images in Flutter

Image endpoints return a **pure base64 string** in `result`. Decode it directly:

```dart
import 'dart:convert';
import 'package:flutter/material.dart';

Uint8List imageBytes = base64Decode(response['result']);

Image.memory(imageBytes)
```

---

## Credit Deduction

Every response includes `total_tokens` (input + output tokens combined). Use this to deduct credits from the user's account.

```dart
int tokensUsed = response['total_tokens'];
// Deduct credits based on tokensUsed
```

---

## Image Part Ordering

For image endpoints, the server sends images to Gemini in this exact order. The model's logic depends on it — do not swap them.

```
[image_base64] → [image_base64_2] → [prompt text]
```

| Endpoint | `image_base64` | `image_base64_2` |
|---|---|---|
| Virtual Try-On | Person photo | Clothing item |
| Outfit Combo | Shirt | Pant |

---

## Server-Side Gemini Configuration

Applied automatically on every SmartCloset request. You do not need to send these from the app.

### Generation Parameters

| Parameter | Value | Reason |
|---|---|---|
| `temperature` | `1.0` | Creative yet style-accurate suggestions |
| `topP` | `0.95` | Nucleus sampling for quality output |
| `topK` | `40` | Top-k sampling |
| `maxOutputTokens` | `2048` | Minimum for high-res image data or long styling advice |

### Safety Settings

Applied to all image endpoints to prevent false-positive blocks on valid fashion images.

| Category | Threshold |
|---|---|
| `HARM_CATEGORY_HARASSMENT` | `BLOCK_NONE` |
| `HARM_CATEGORY_HATE_SPEECH` | `BLOCK_NONE` |
| `HARM_CATEGORY_SEXUALLY_EXPLICIT` | `BLOCK_NONE` |
| `HARM_CATEGORY_DANGEROUS_CONTENT` | `BLOCK_NONE` |

> Fashion chat uses default safety settings since it is text-only and less prone to false positives.

---

## Models Used

| Model | Endpoint | Purpose |
|---|---|---|
| `gemini-2.5-flash` | `/api/gemini/chat` | Text-based fashion chat |
| `gemini-2.5-flash-image` | `/api/gemini/image` | Image generation — try-on & outfit combo |

---

## Supported Image Formats

| Format | `mime_type` |
|---|---|
| JPEG / JPG | `image/jpeg` |
| PNG | `image/png` |
| WebP | `image/webp` |

---

## Route Summary

| Endpoint | Direct URL | Prefixed URL | Proxy URL | Auth |
|---|---|---|---|---|
| Fashion Chat | `POST /fashion-chat` | `POST /api/smartcloset/fashion-chat` | `POST /api/gemini/chat` | ✅ |
| Virtual Try-On | `POST /virtual-tryon` | `POST /api/smartcloset/virtual-tryon` | `POST /api/gemini/image` | ✅ |
| Outfit Combo | `POST /outfit-combo` | `POST /api/smartcloset/outfit-combo` | `POST /api/gemini/image` | ✅ |

---

## Flutter Files Reference

| Flutter File | Proxy Endpoint |
|---|---|
| `gemini_service.dart` | `POST /api/gemini/chat` |
| `virtualtryon.dart` | `POST /api/gemini/image` |
| `outfitcombopage.dart` | `POST /api/gemini/image` |

---

## Security Notes

- All requests without a valid `x-api-key` return `401`
- The Gemini API key is never sent to or from the Flutter app — it lives only on the server
- Store `SERVER_ACCESS_KEY` securely using `flutter_dotenv` or `--dart-define` in production
- `GEMINI_PROXY_BASE_URL` in the Flutter `.env` can be updated anytime to point to a new server without code changes
