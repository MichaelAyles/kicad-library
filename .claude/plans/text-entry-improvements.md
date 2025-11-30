# Text Entry Improvements Plan

## Current State Analysis

### What Exists Today

| Location | Field | Character Limit | Markdown Support | Backend Validation |
|----------|-------|-----------------|------------------|-------------------|
| Upload flow | Title | None | No | No |
| Upload flow | Description | None | No | No |
| Edit page | Title | 100 (frontend+backend) | No | Yes |
| Edit page | Description | 1000 (frontend+backend) | No | Yes |
| Comments | Content | 5000 (frontend only) | Yes (write/preview tabs) | No |
| Settings | Bio | 500 | No | Unknown |

### Security Status
- **Comments**: Using `react-markdown` + `rehype-sanitize` (XSS protected)
- **Circuit fields**: Plain text rendering (safe by default)
- **No `dangerouslySetInnerHTML`**: All rendering is safe
- **Gap**: Backend validation missing for upload and comments

---

## Proposed Changes

### 1. Create Reusable `MarkdownEditor` Component

A unified text entry component with three modes, similar to GitHub's PR comment box.

**Location**: `src/components/MarkdownEditor.tsx`

**Features**:
- **Three tabs**: Write | Preview | Help
- **Write mode**: Plain textarea for raw markdown input
- **Preview mode**: Live rendered markdown preview using existing `MarkdownRenderer`
- **Help mode**: Quick reference for markdown syntax
- **Character counter**: Shows current/max with color warning near limit
- **Toolbar** (optional): Bold, italic, code, link buttons that insert markdown syntax
- **Props**:
  ```typescript
  interface MarkdownEditorProps {
    value: string;
    onChange: (value: string) => void;
    maxLength: number;
    placeholder?: string;
    minRows?: number;
    maxRows?: number;
    disabled?: boolean;
    showToolbar?: boolean;  // Optional formatting buttons
    label?: string;
    required?: boolean;
  }
  ```

### 2. Update Character Limits

**Confirmed limits**:

| Field | Current | New |
|-------|---------|-----|
| Circuit Title | None/100 | 150 |
| Circuit Description | None/1000 | 10000 |
| Comment Content | 5000 | 10000 |
| Tag (each) | 30 | 30 (keep) |
| Tags (count) | 10 | 10 (keep) |
| Bio | 500 | 10000 |

### 3. Update Upload Flow (`src/app/upload/page.tsx`)

**Changes**:
1. Replace description `<textarea>` with `<MarkdownEditor>`
2. Add `maxLength={5000}` for description
3. Add `maxLength={150}` for title
4. Add character counters for both fields
5. Add hint text: "Supports Markdown formatting"

### 4. Update Edit Page (`src/app/circuit/[slug]/edit/page.tsx`)

**Changes**:
1. Replace description `<textarea>` with `<MarkdownEditor>`
2. Update `maxLength` from 1000 to 5000
3. Update title `maxLength` from 100 to 150
4. Keep existing character counters (enhance with color warnings)

### 5. Update Comments System

**CommentForm.tsx**:
1. Replace current implementation with `<MarkdownEditor>`
2. Update `maxLength` from 5000 to 10000
3. Already has write/preview - ensure consistency with new component

**Comment.tsx** (edit mode):
1. Replace current edit textarea with `<MarkdownEditor>`
2. Update `maxLength` from 5000 to 10000

### 6. Add Backend Validation

**Create/Update API routes**:

1. **Upload API** (`src/app/api/subcircuits/route.ts` or equivalent):
   ```typescript
   // Add validation
   if (title.length > 150) return error("Title max 150 chars")
   if (description.length > 5000) return error("Description max 5000 chars")
   ```

2. **Edit API** (`src/app/api/circuits/[id]/route.ts`):
   - Update title limit: 100 → 150
   - Update description limit: 1000 → 5000

3. **Comments** (`src/lib/comments.ts`):
   - Add validation in `createComment()` and `updateComment()`
   - Enforce 10000 character limit server-side

### 7. Circuit Detail Page - Render Markdown

**Update** `src/app/circuit/[slug]/page.tsx`:
- Render circuit description using `<MarkdownRenderer>` instead of plain text
- This enables markdown in existing and new circuit descriptions

### 8. Security Enhancements

**Already in place**:
- `rehype-sanitize` for markdown HTML sanitization
- React's automatic JSX escaping

**To add**:
- Input sanitization on backend (trim whitespace, normalize line endings)
- Rate limiting consideration for comments (future)

---

## Component Design: MarkdownEditor

**Tab naming**: Use modern terminology
- ~~Write~~ → **Edit** (plain text input)
- ~~Rich~~ → **Interactive** (with formatting toolbar)
- **Preview** (rendered markdown)
- **Help** (syntax reference)

```
┌─────────────────────────────────────────────────────────┐
│ Description *                                           │
├─────────────────────────────────────────────────────────┤
│ [Edit] [Interactive] [Preview] [?]                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  When "Interactive" tab selected:                       │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ [B] [I] [S] [``] [Code] [🔗] [Image] [List] [Quote] │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │                                                     │ │
│ │  Textarea with same content...                      │ │
│ │  Toolbar inserts markdown syntax at cursor          │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│  When "Edit" tab selected:                              │
│ ┌─────────────────────────────────────────────────────┐ │
│ │  Plain textarea, no toolbar                         │ │
│ │  For users who know markdown                        │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│                                         1,234 / 10,000  │
└─────────────────────────────────────────────────────────┘
```

**Toolbar buttons** (Interactive mode):
- **B** - Bold (`**text**`)
- **I** - Italic (`*text*`)
- **S** - Strikethrough (`~~text~~`)
- **``** - Inline code
- **Code** - Code block
- **Link** - Insert link
- **List** - Bullet list
- **Numbered** - Numbered list
- **Quote** - Blockquote

**Help tab content**:
```markdown
## Markdown Quick Reference

**Bold**: `**text**` → **text**
*Italic*: `*text*` → *text*
`Code`: `` `code` `` → `code`
[Link]: `[text](url)` → [text](url)

### Code Block:
```language
code here
```

### Lists:
- Item 1
- Item 2

1. First
2. Second

### Quote:
> Quoted text
```

---

## Implementation Order

1. **Phase 1**: Create `MarkdownEditor` component
   - Build core component with 4 tabs (Edit, Interactive, Preview, Help)
   - Add formatting toolbar for Interactive mode
   - Add character counter with color warnings
   - Add help tab with syntax reference
   - Test in isolation

2. **Phase 2**: Update Upload Flow
   - Integrate MarkdownEditor for description (10k limit)
   - Add title character limit (150)
   - Add backend validation for upload API

3. **Phase 3**: Update Edit Page
   - Replace description textarea with MarkdownEditor (10k limit)
   - Update title limit (100 → 150)
   - Update backend validation

4. **Phase 4**: Update Comments
   - Update CommentForm to use MarkdownEditor (10k limit)
   - Update Comment edit mode (10k limit)
   - Add backend validation in comments.ts

5. **Phase 5**: Update Settings Page
   - Replace bio textarea with MarkdownEditor (10k limit)
   - Add backend validation for profile API

6. **Phase 6**: Enable Markdown Rendering in Display
   - Update circuit detail page to render description with MarkdownRenderer
   - Update profile page to render bio with MarkdownRenderer

---

## Decisions Made

1. **Character limits**: Title 150, Description 10k, Comments 10k, Bio 10k
2. **Toolbar**: Yes - include formatting buttons in "Interactive" mode
3. **Markdown in titles**: No - titles remain plain text only
4. **Bio field**: Yes - settings page bio gets the markdown editor
5. **Backwards compatibility**: Existing plain text will render fine (no migration needed)

---

## Files to Create/Modify

### New Files:
- `src/components/MarkdownEditor.tsx` - Main reusable component

### Modified Files:
- `src/app/upload/page.tsx` - Use MarkdownEditor for description
- `src/app/circuit/[slug]/edit/page.tsx` - Use MarkdownEditor for description
- `src/app/circuit/[slug]/page.tsx` - Render description with MarkdownRenderer
- `src/app/settings/page.tsx` - Use MarkdownEditor for bio
- `src/app/profile/page.tsx` - Render bio with MarkdownRenderer (if showing bio)
- `src/components/CommentForm.tsx` - Use MarkdownEditor
- `src/components/Comment.tsx` - Use MarkdownEditor for edit mode
- `src/lib/comments.ts` - Add backend validation (10k limit)
- `src/app/api/circuits/[id]/route.ts` - Update limits (title 150, desc 10k)
- `src/app/api/subcircuits/route.ts` (or upload route) - Add validation
- `src/app/api/profile/route.ts` (or equivalent) - Add bio validation

---

## Estimated Scope

- **New component**: ~300 lines (with toolbar)
- **Upload page changes**: ~50 lines
- **Edit page changes**: ~30 lines
- **Settings page changes**: ~30 lines
- **Comments changes**: ~40 lines
- **API validation**: ~80 lines
- **Display rendering**: ~20 lines

**Total**: ~550 lines of changes across 11-12 files
