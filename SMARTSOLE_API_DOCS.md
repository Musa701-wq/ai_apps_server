# SmartSole API — Integration Guide

Base URL: `https://apps-model-server.mirdemy.com`

---

## Models Overview

| Model | Role | Features |
| :--- | :--- | :--- |
| `gemini-1.5-flash` | Text only | Text queries, Shoe search query generation |
| `gemini-2.5-flash-image` | Image generation | Virtual Try-On, Multi-Angle Studio, Outfit Matcher (image) |
| `gemini-2.0-flash` | Multimodal (image → text) | Shoe Analysis (outfit suggestions), Stylist Notes |

---

## API Migration Map

| Feature | Legacy Model | New Proxy Endpoint | Model at Proxy |
| :--- | :--- | :--- | :--- |
| **Text Queries / SmartSole 2** | `gemini-1.5-flash` | `POST /api/smartsole/text` | `gemini-1.5-flash` |
| **Shoe Search Query Generation** | `gemini-1.5-flash` | `POST /api/smartsole/text` | `gemini-1.5-flash` |
| **Virtual Try-On** | `gemini-2.5-flash-image` | `POST /api/smartsole/image` | `gemini-2.5-flash-image` |
| **Multi-Angle Studio** | `gemini-2.5-flash-image` | `POST /api/smartsole/image` | `gemini-2.5-flash-image` |
| **Outfit Matcher** | `gemini-2.5-flash-image` | `POST /api/smartsole/image` | `gemini-2.5-flash-image` |
| **Shoe Analysis (Outfit Suggestions)** | `gemini-2.0-flash` | `POST /api/smartsole/multimodal` | `gemini-2.0-flash` |
| **Stylist Notes** | `gemini-2.0-flash` | `POST /api/smartsole/multimodal` | `gemini-2.0-flash` |

> **Note on Stylist Notes:** In the original Flutter app, Stylist Notes ran on `gemini-2.0-flash` in parallel with the Outfit Matcher image call. On the proxy, the same model is used — the Flutter app makes a separate `/multimodal` call for the stylist note while the image call goes to `/image`.

---

## Authentication

All endpoints are protected. Every request must include the `x-api-key` header.

```
x-api-key: YOUR_SERVER_ACCESS_KEY
```

> Stored in `.env` as `SERVER_ACCESS_KEY`. Never expose this key publicly.

---

## Endpoints Overview

| Endpoint | Method | Auth | Model | Features |
|---|---|---|---|---|
| `/api/smartsole/text` | POST | ✅ | `gemini-1.5-flash` | Text Queries, Shoe Search Query Generation |
| `/api/smartsole/image` | POST | ✅ | `gemini-2.5-flash-image` | Virtual Try-On, Multi-Angle Studio, Outfit Matcher |
| `/api/smartsole/multimodal` | POST | ✅ | `gemini-2.0-flash` | Shoe Analysis (Outfit Suggestions), Stylist Notes |

---

## Endpoint Details

---

### 1. `POST /api/smartsole/text`

**Model:** `gemini-1.5-flash`  
**Features:**
- **Text Queries / SmartSole 2** — User ke prompts process karna, text responses banana
- **Shoe Search Query Generation** — Natural language se clean shoe search query extract karna

**Request:**
```json
{
  "prompt": "Your text prompt here"
}
```

| Field | Type | Required |
|---|---|---|
| `prompt` | String | ✅ Yes |

**Server-applied generationConfig:**
```
temperature: 0.4  |  topK: 32  |  topP: 1  |  maxOutputTokens: 4096
```

**Response:**
```json
{
  "result": "AI text response here",
  "total_tokens": 210
}
```

---

### 2. `POST /api/smartsole/image`

**Model:** `gemini-2.5-flash-image`  
**Features:**
- **Virtual Try-On** — User photo + shoe image → composite image with shoe on person's feet
- **Multi-Angle Studio** — Side view / different angle shoe placement on person
- **Outfit Matcher** — Shoe + optional user photo → outfit composite image

**Request:**
```json
{
  "prompt": "Your generation prompt here",
  "image_base64": "...",
  "mime_type": "image/jpeg",
  "image_base64_2": "...",
  "mime_type_2": "image/jpeg"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `prompt` | String | ✅ Yes | Image generation instruction |
| `image_base64` | String | ❌ Optional | First image in Base64 |
| `mime_type` | String | ❌ Optional | MIME type of first image |
| `image_base64_2` | String | ❌ Optional | Second image in Base64 |
| `mime_type_2` | String | ❌ Optional | MIME type of second image |

**Parts order sent to Gemini (must not change — model logic depends on it):**
```
[prompt text] → [image_base64] → [image_base64_2]
```

**Image field mapping per feature:**

| Feature | `image_base64` | `image_base64_2` |
|---|---|---|
| Virtual Try-On | Person photo | Shoe image |
| Multi-Angle Studio | Person photo | Shoe image |
| Outfit Matcher | Shoe image | Person photo *(optional)* |

**Safety Settings (auto-applied — BLOCK_NONE on all categories):**
Prevents false-positive blocks on valid shoe/fashion images.

**Response:**
```json
{
  "result": "pure_base64_generated_image_string",
  "total_tokens": 1240
}
```

> `result` is a **pure base64 string** of the generated image. Decode with `base64Decode()` in Flutter.

---

### 3. `POST /api/smartsole/multimodal`

**Model:** `gemini-2.0-flash`  
**Features:**
- **Shoe Analysis / Dynamic Outfit Suggestions** — Shoe photo analyze karke outfit combinations suggest karna (returns JSON array)
- **AI Stylist Notes** — Shoe + outfit choice ke basis par 1-sentence stylist note generate karna (runs parallel to `/image` call in Flutter)

**Request:**
```json
{
  "prompt": "Your analysis prompt here",
  "image_base64": "...",
  "mime_type": "image/jpeg"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `prompt` | String | ✅ Yes | Analysis instruction or stylist prompt |
| `image_base64` | String | ❌ Optional | Shoe image in Base64 |
| `mime_type` | String | ❌ Optional | MIME type of image |

**Server-applied generationConfig:**
```
temperature: 0.7  |  maxOutputTokens: 1024
```

**Response:**
```json
{
  "result": "AI analysis text or stylist note here",
  "total_tokens": 380
}
```

**For Shoe Analysis** — `result` contains a JSON array (as string). Parse it in Flutter:
```dart
// result = '[{"outfit": "...", "occasion": "...", "style_tip": "..."}]'
final suggestions = jsonDecode(response['result']) as List;
```

**For Stylist Notes** — `result` contains plain text starting with `STYLIST NOTE:`:
```dart
// result = 'STYLIST NOTE: These white sneakers pair perfectly with...'
final note = result.split('STYLIST NOTE:').last.trim();
```

---

## Parallel Calls — Outfit Matcher + Stylist Note

In the original Flutter app, `generateOutfitMatch()` fires two API calls simultaneously using `Future.wait`:
1. `/image` → generates the outfit composite image (`gemini-2.5-flash-image`)
2. `/multimodal` → generates the stylist note (`gemini-2.0-flash`)

On the proxy, the Flutter app makes **both calls in parallel** the same way — no change needed:

```dart
final results = await Future.wait([
  geminiService.generateOutfitMatchImage(...),  // → POST /api/smartsole/image
  geminiService.getStylistNote(...),             // → POST /api/smartsole/multimodal
]);
```

---

## Common Response Format

**Success (200):**
```json
{
  "result": "text response or base64 image string",
  "total_tokens": 450
}
```

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
  "code": "TEXT_MODEL_ERROR | IMAGE_MODEL_ERROR | MULTIMODAL_MODEL_ERROR | NO_IMAGE"
}
```

---

## Error Codes Reference

| Code | HTTP Status | Description |
|---|---|---|
| `AUTH_FAILED` | 401 | Missing or invalid `x-api-key` header |
| `MISSING_FIELD` | 400 | `prompt` field not provided |
| `SAFETY_BLOCK` | 422 | Request blocked by Gemini safety filters |
| `TEXT_MODEL_ERROR` | 500 | Internal error in `/text` |
| `IMAGE_MODEL_ERROR` | 500 | Internal error in `/image` |
| `MULTIMODAL_MODEL_ERROR` | 500 | Internal error in `/multimodal` |
| `NO_IMAGE` | 500 | AI responded but generated no image |

---

## Test with cURL

**Text Query / Search Query:**
```bash
curl -X POST https://apps-model-server.mirdemy.com/api/smartsole/text \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_SERVER_ACCESS_KEY" \
  -d '{"prompt": "What shoe styles go well with formal suits?"}'
```

**Virtual Try-On / Multi-Angle Studio / Outfit Matcher:**
```bash
curl -X POST https://apps-model-server.mirdemy.com/api/smartsole/image \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_SERVER_ACCESS_KEY" \
  -d '{
    "prompt": "Place these shoes on the person realistically...",
    "image_base64": "base64_first_image_here",
    "mime_type": "image/jpeg",
    "image_base64_2": "base64_second_image_here",
    "mime_type_2": "image/jpeg"
  }'
```

**Shoe Analysis / Stylist Notes:**
```bash
curl -X POST https://apps-model-server.mirdemy.com/api/smartsole/multimodal \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_SERVER_ACCESS_KEY" \
  -d '{
    "prompt": "Analyze this shoe and suggest outfit combinations...",
    "image_base64": "base64_shoe_image_here",
    "mime_type": "image/jpeg"
  }'
```

---

## Flutter Migration

### What Changes

| | Before (Direct Google API) | After (Proxy) |
|---|---|---|
| API Key | Hardcoded in `GeminiService` | Removed from app — lives on server |
| Auth header | `x-goog-api-key` sent from app | `x-api-key: SERVER_ACCESS_KEY` |
| Base URL | `generativelanguage.googleapis.com` | `apps-model-server.mirdemy.com` |
| Request payload | Same | Same — no changes |
| Response format | Same | Same — no changes |
| Parallel calls | `Future.wait` in app | Still `Future.wait` in app — both calls hit proxy |

### Environment Variable

Add to your Flutter `.env`:
```
SMARTSOLE_BASE_URL=https://apps-model-server.mirdemy.com
SMARTSOLE_ACCESS_KEY=YOUR_SERVER_ACCESS_KEY
```

### Updated `gemini_service.dart`

```dart
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:http/http.dart' as http;
import '../prompts/ai_studio_prompt.dart';

class GeminiService {
  // ── Replace these two lines ────────────────────────────────────────────
  // BEFORE:
  //   final String apiKey = "AIza...";
  //   final String textModel = "gemini-1.5-flash";
  //   final String imageModel = "gemini-2.5-flash-image";
  //
  // AFTER:
  static const String _baseUrl   = 'https://apps-model-server.mirdemy.com';
  static const String _accessKey = 'YOUR_SERVER_ACCESS_KEY';

  static Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    'x-api-key': _accessKey,   // replaces x-goog-api-key
  };

  Future<String> _encodeImage(File f) async =>
      base64Encode(await f.readAsBytes());

  // ── Text Queries / SmartSole 2 → POST /api/smartsole/text ─────────────
  // Model: gemini-1.5-flash (unchanged)
  Future<Map<String, dynamic>> generateTextResponse(String prompt) async {
    final res = await http.post(
      Uri.parse('$_baseUrl/api/smartsole/text'),
      headers: _headers,
      body: jsonEncode({'prompt': prompt}),
    );
    if (res.statusCode == 200) {
      final data = jsonDecode(res.body);
      return {'success': true, 'text': data['result'] ?? ''};
    }
    return {'success': false, 'error': 'API Error: ${res.statusCode}', 'details': res.body};
  }

  // ── Shoe Search Query → POST /api/smartsole/text ──────────────────────
  // Model: gemini-1.5-flash (unchanged)
  Future<Map<String, dynamic>> getShoeSearchQuery(String prompt) async {
    final result = await generateTextResponse(prompt);
    if (result['success'] == true) {
      String query = (result['text'] ?? '').trim()
          .replaceAll(RegExp(r'["\[\]\{\}]'), '')
          .replaceAll(RegExp(r'\s+'), ' ')
          .split('\n').first.trim();
      return {'success': true, 'query': query};
    }
    return result;
  }

  // ── Virtual Try-On → POST /api/smartsole/image ────────────────────────
  // Model: gemini-2.5-flash-image (unchanged)
  Future<Map<String, dynamic>> generateVirtualTryOn({
    required File userImage,
    required File shoeImage,
    required String size,
    String? cameraAngle,
  }) async {
    final angleRule = cameraAngle != null
        ? 'CRITICAL: The second input is a SIDE VIEW profile of the shoe. Maintain the person\'s original identity, body pose, and background exactly. However, realistically map the side-profile shoe onto their foot. Let their foot naturally point sideways to showcase the pure side angle of the footwear. DO NOT duplicate people or limbs.'
        : 'CRITICAL: Maintain the exact same background, pose, and rotation as the person\'s original image.';

    final res = await http.post(
      Uri.parse('$_baseUrl/api/smartsole/image'),
      headers: _headers,
      body: jsonEncode({
        'prompt':         '/* your existing try-on prompt string with $angleRule */',
        'image_base64':   await _encodeImage(userImage),   // person photo
        'mime_type':      'image/jpeg',
        'image_base64_2': await _encodeImage(shoeImage),   // shoe image
        'mime_type_2':    'image/jpeg',
      }),
    );
    if (res.statusCode == 200) {
      final data  = jsonDecode(res.body);
      final img   = data['result'] as String?;
      if (img != null) return {'success': true, 'image': base64Decode(img)};
    }
    return {'success': false, 'error': 'API Error: ${res.statusCode}', 'details': res.body};
  }

  // ── Multi-Angle Studio → POST /api/smartsole/image ───────────────────
  // Model: gemini-2.5-flash-image (unchanged)
  Future<Map<String, dynamic>> generateMultiAngleTryOn({
    required File userImage,
    required File shoeImage,
    required String size,
    String? cameraAngle,
  }) async {
    final angleRule = cameraAngle != null
        ? 'CRITICAL: The second input is a SIDE VIEW profile of the shoe...'
        : 'CRITICAL: Maintain the exact same background, pose, and rotation...';

    final res = await http.post(
      Uri.parse('$_baseUrl/api/smartsole/image'),
      headers: _headers,
      body: jsonEncode({
        'prompt':         AIPrompts.multiAngleTryOn(size, angleRule),
        'image_base64':   await _encodeImage(userImage),   // person photo
        'mime_type':      'image/jpeg',
        'image_base64_2': await _encodeImage(shoeImage),   // shoe image
        'mime_type_2':    'image/jpeg',
      }),
    );
    if (res.statusCode == 200) {
      final data = jsonDecode(res.body);
      final img  = data['result'] as String?;
      if (img != null) return {'success': true, 'image': base64Decode(img)};
    }
    return {'success': false, 'error': 'API Error: ${res.statusCode}', 'details': res.body};
  }

  // ── Shoe Analysis → POST /api/smartsole/multimodal ───────────────────
  // Model: gemini-2.0-flash (unchanged)
  Future<Map<String, dynamic>> analyzeShoeForOutfits({
    required File shoeImage,
  }) async {
    final res = await http.post(
      Uri.parse('$_baseUrl/api/smartsole/multimodal'),
      headers: _headers,
      body: jsonEncode({
        'prompt':       AIPrompts.outfitSuggestionPrompt(),
        'image_base64': await _encodeImage(shoeImage),
        'mime_type':    'image/jpeg',
      }),
    );
    if (res.statusCode == 200) {
      final data = jsonDecode(res.body);
      String text = (data['result'] as String? ?? '').trim();
      // Clean markdown (same logic as before)
      if (text.contains('```')) {
        final m = RegExp(r'```(?:json)?\s*([\s\S]*?)\s*```').firstMatch(text);
        if (m != null) text = m.group(1)!.trim();
      }
      if (!text.startsWith('[')) {
        final m = RegExp(r'\[[\s\S]*\]').firstMatch(text);
        if (m != null) text = m.group(0)!;
      }
      try {
        return {'success': true, 'suggestions': jsonDecode(text)};
      } catch (_) {
        return {'success': false, 'error': 'AI could not format suggestions correctly. Please try a clearer photo or a different angle.'};
      }
    }
    return {'success': false, 'error': 'API Error: ${res.statusCode}', 'details': res.body};
  }

  // ── Outfit Matcher (image) → POST /api/smartsole/image ───────────────
  // ── Stylist Note (parallel) → POST /api/smartsole/multimodal ─────────
  // Image model:   gemini-2.5-flash-image (unchanged)
  // Stylist model: gemini-2.0-flash       (unchanged — was already 2.0-flash)
  Future<Map<String, dynamic>> generateOutfitMatch({
    required File shoeImage,
    String? outfit,
    File? userImage,
  }) async {
    final isAutonomous = outfit == null || outfit.contains('autonomously');

    final stylistPrompt = isAutonomous
        ? "You are an expert AI fashion stylist. I am providing an image of some shoes. "
          "You must autonomously decide the absolute perfect, highest-end single outfit to wear with them. "
          "Respond in exactly 1 sentence describing the full outfit and why it works, "
          "starting precisely with 'STYLIST NOTE: '."
        : "You are an expert AI fashion stylist. I am providing an image of some shoes. "
          "The user chose to wear them with this outfit: '$outfit'. "
          "Provide exactly 1 sentence explaining why this is a surprisingly great high-end fashion choice, "
          "starting precisely with 'STYLIST NOTE: '.";

    final shoeBase64 = await _encodeImage(shoeImage);

    // Image generation body
    final Map<String, dynamic> imageBody = {
      'prompt':       AIPrompts.outfitMatcherPrompt(outfit: outfit, hasPerson: userImage != null),
      'image_base64': shoeBase64,
      'mime_type':    'image/jpeg',
    };
    if (userImage != null) {
      imageBody['image_base64_2'] = await _encodeImage(userImage);
      imageBody['mime_type_2']    = 'image/jpeg';
    }

    // Stylist note body
    final stylistBody = {
      'prompt':       stylistPrompt,
      'image_base64': shoeBase64,
      'mime_type':    'image/jpeg',
    };

    // Fire both in parallel — same as original Future.wait
    final results = await Future.wait([
      http.post(Uri.parse('$_baseUrl/api/smartsole/image'),
          headers: _headers, body: jsonEncode(imageBody)),
      http.post(Uri.parse('$_baseUrl/api/smartsole/multimodal'),
          headers: _headers, body: jsonEncode(stylistBody)),
    ]);

    final imageRes   = results[0];
    final stylistRes = results[1];

    // Process image
    if (imageRes.statusCode != 200) {
      return {'success': false, 'error': 'API Error: ${imageRes.statusCode}', 'details': imageRes.body};
    }
    final imageData = jsonDecode(imageRes.body);
    final imgBase64 = imageData['result'] as String?;
    if (imgBase64 == null) {
      return {'success': false, 'error': 'No image generated'};
    }

    // Process stylist note (non-fatal fallback)
    String stylistNote = 'Our AI Stylist selected this perfect match for your shoes.';
    if (stylistRes.statusCode == 200) {
      final stylistData = jsonDecode(stylistRes.body);
      final raw = (stylistData['result'] as String? ?? '').trim();
      if (raw.isNotEmpty) {
        stylistNote = raw.contains('STYLIST NOTE:')
            ? raw.split('STYLIST NOTE:').last.trim()
            : raw;
      }
    }

    return {
      'success':      true,
      'image':        base64Decode(imgBase64),
      'stylist_note': stylistNote,
      'instructions': 'Outfit match generated successfully',
    };
  }
}
```

---

## Displaying Generated Images in Flutter

```dart
import 'dart:convert';
import 'package:flutter/material.dart';

// From /image endpoint
Uint8List imageBytes = base64Decode(response['result'] as String);
Image.memory(imageBytes)

// From generateOutfitMatch() — already decoded
Uint8List imageBytes = response['image'] as Uint8List;
Image.memory(imageBytes)
```

---

## Credit Deduction

```dart
int tokensUsed = response['total_tokens'] as int;
// Deduct credits based on tokensUsed
```

---

## Safety Settings — `/api/smartsole/image`

Applied automatically. Prevents false-positive blocks on valid shoe/fashion images.

| Category | Threshold |
|---|---|
| `HARM_CATEGORY_HARASSMENT` | `BLOCK_NONE` |
| `HARM_CATEGORY_HATE_SPEECH` | `BLOCK_NONE` |
| `HARM_CATEGORY_SEXUALLY_EXPLICIT` | `BLOCK_NONE` |
| `HARM_CATEGORY_DANGEROUS_CONTENT` | `BLOCK_NONE` |

---

## Supported Image Formats

| Format | `mime_type` |
|---|---|
| JPEG / JPG | `image/jpeg` |
| PNG | `image/png` |
| WebP | `image/webp` |

---

## Security Notes

- All requests without a valid `x-api-key` return `401`
- Gemini API keys are never sent to or from the Flutter app — they live only on the server
- Store `SMARTSOLE_ACCESS_KEY` securely using `flutter_dotenv` or `--dart-define` in production
- `SMARTSOLE_BASE_URL` can be updated anytime without code changes
