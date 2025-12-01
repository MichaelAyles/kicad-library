"use client";

import { useState, useRef, useCallback } from "react";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Link,
  List,
  ListOrdered,
  Quote,
  HelpCircle,
  FileCode,
} from "lucide-react";
import { MarkdownRenderer } from "./MarkdownRenderer";

type EditorMode = "edit" | "interactive" | "preview" | "help";

interface MarkdownEditorProps {
  /** Current value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Maximum character limit */
  maxLength: number;
  /** Placeholder text */
  placeholder?: string;
  /** Minimum rows for textarea */
  minRows?: number;
  /** Maximum rows for textarea (auto-grows up to this) */
  maxRows?: number;
  /** Disable the editor */
  disabled?: boolean;
  /** Label for the field */
  label?: string;
  /** Whether field is required */
  required?: boolean;
  /** Additional class name for the container */
  className?: string;
  /** Default mode to start in */
  defaultMode?: EditorMode;
}

interface ToolbarButton {
  icon: React.ReactNode;
  label: string;
  action: "wrap" | "prefix" | "block";
  before: string;
  after?: string;
}

const toolbarButtons: ToolbarButton[] = [
  {
    icon: <Bold className="w-4 h-4" />,
    label: "Bold",
    action: "wrap",
    before: "**",
    after: "**",
  },
  {
    icon: <Italic className="w-4 h-4" />,
    label: "Italic",
    action: "wrap",
    before: "*",
    after: "*",
  },
  {
    icon: <Strikethrough className="w-4 h-4" />,
    label: "Strikethrough",
    action: "wrap",
    before: "~~",
    after: "~~",
  },
  {
    icon: <Code className="w-4 h-4" />,
    label: "Inline code",
    action: "wrap",
    before: "`",
    after: "`",
  },
  {
    icon: <FileCode className="w-4 h-4" />,
    label: "Code block",
    action: "block",
    before: "```\n",
    after: "\n```",
  },
  {
    icon: <Link className="w-4 h-4" />,
    label: "Link",
    action: "wrap",
    before: "[",
    after: "](url)",
  },
  {
    icon: <List className="w-4 h-4" />,
    label: "Bullet list",
    action: "prefix",
    before: "- ",
  },
  {
    icon: <ListOrdered className="w-4 h-4" />,
    label: "Numbered list",
    action: "prefix",
    before: "1. ",
  },
  {
    icon: <Quote className="w-4 h-4" />,
    label: "Quote",
    action: "prefix",
    before: "> ",
  },
];

const helpContent = `## Markdown Quick Reference

**Bold**: \`**text**\` → **text**

*Italic*: \`*text*\` → *italic*

~~Strikethrough~~: \`~~text~~\` → ~~strikethrough~~

\`Inline code\`: \`\\\`code\\\`\` → \`code\`

### Code Block
\`\`\`
\`\`\`language
code here
\`\`\`
\`\`\`

### Links
\`[link text](https://example.com)\` → [link text](https://example.com)

### Lists
\`\`\`
- Item 1
- Item 2

1. First
2. Second
\`\`\`

### Quote
\`> Quoted text\`
> Quoted text

### Headings
\`\`\`
# Heading 1
## Heading 2
### Heading 3
\`\`\`
`;

/**
 * Multi-mode markdown editor with tabs for Edit, Interactive, Preview, and Help.
 * Interactive mode includes a formatting toolbar.
 */
export function MarkdownEditor({
  value,
  onChange,
  maxLength,
  placeholder = "Enter text...",
  minRows = 4,
  maxRows = 20,
  disabled = false,
  label,
  required = false,
  className = "",
  defaultMode = "interactive",
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<EditorMode>(defaultMode);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Calculate character count and warning level
  const charCount = value.length;
  const charPercentage = (charCount / maxLength) * 100;
  const charWarning =
    charPercentage >= 90
      ? "error"
      : charPercentage >= 75
        ? "warning"
        : "normal";

  // Insert text at cursor position
  const insertText = useCallback(
    (button: ToolbarButton) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = value.substring(start, end);
      const beforeText = value.substring(0, start);
      const afterText = value.substring(end);

      let newText: string;
      let newCursorPos: number;

      if (button.action === "wrap") {
        // Wrap selected text or insert placeholder
        const textToWrap = selectedText || "text";
        newText =
          beforeText +
          button.before +
          textToWrap +
          (button.after || "") +
          afterText;
        newCursorPos = start + button.before.length + textToWrap.length;
      } else if (button.action === "prefix") {
        // Add prefix at line start
        const lineStart = beforeText.lastIndexOf("\n") + 1;
        const beforeLine = value.substring(0, lineStart);
        const currentLine = value.substring(lineStart, end);
        newText = beforeLine + button.before + currentLine + afterText;
        newCursorPos = start + button.before.length;
      } else {
        // Block: insert on new lines
        const needsNewlineBefore =
          beforeText.length > 0 && !beforeText.endsWith("\n");
        const needsNewlineAfter =
          afterText.length > 0 && !afterText.startsWith("\n");
        const textToInsert = selectedText || "code";
        newText =
          beforeText +
          (needsNewlineBefore ? "\n" : "") +
          button.before +
          textToInsert +
          (button.after || "") +
          (needsNewlineAfter ? "\n" : "") +
          afterText;
        newCursorPos =
          beforeText.length +
          (needsNewlineBefore ? 1 : 0) +
          button.before.length +
          textToInsert.length;
      }

      // Check max length
      if (newText.length > maxLength) {
        return;
      }

      onChange(newText);

      // Restore focus and cursor position
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    },
    [value, onChange, maxLength],
  );

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && mode === "interactive") {
        const key = e.key.toLowerCase();
        if (key === "b") {
          e.preventDefault();
          insertText(toolbarButtons[0]); // Bold
        } else if (key === "i") {
          e.preventDefault();
          insertText(toolbarButtons[1]); // Italic
        } else if (key === "k") {
          e.preventDefault();
          insertText(toolbarButtons[5]); // Link
        }
      }
    },
    [mode, insertText],
  );

  const tabs: { id: EditorMode; label: string; icon?: React.ReactNode }[] = [
    { id: "edit", label: "Edit" },
    { id: "interactive", label: "Interactive" },
    { id: "preview", label: "Preview" },
    { id: "help", label: "", icon: <HelpCircle className="w-4 h-4" /> },
  ];

  return (
    <div className={`space-y-1 ${className}`}>
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Editor container */}
      <div className="border rounded-md overflow-hidden bg-background">
        {/* Tabs */}
        <div className="flex items-center border-b bg-muted/30">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMode(tab.id)}
              disabled={disabled}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                mode === tab.id
                  ? "bg-background text-foreground border-b-2 border-primary -mb-px"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title={tab.id === "help" ? "Markdown help" : undefined}
            >
              {tab.icon || tab.label}
            </button>
          ))}
        </div>

        {/* Toolbar (Interactive mode only) */}
        {mode === "interactive" && (
          <div className="flex items-center gap-0.5 p-1.5 border-b bg-muted/20">
            {toolbarButtons.map((button, index) => (
              <button
                key={index}
                type="button"
                onClick={() => insertText(button)}
                disabled={disabled}
                className="p-1.5 rounded hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={button.label}
              >
                {button.icon}
              </button>
            ))}
            <span className="ml-auto text-xs text-muted-foreground px-2">
              Ctrl+B Bold, Ctrl+I Italic, Ctrl+K Link
            </span>
          </div>
        )}

        {/* Content area */}
        <div className="relative">
          {(mode === "edit" || mode === "interactive") && (
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => {
                const newValue = e.target.value;
                if (newValue.length <= maxLength) {
                  onChange(newValue);
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              rows={minRows}
              className="w-full px-3 py-2 text-sm bg-transparent resize-y focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                minHeight: `${minRows * 1.5}rem`,
                maxHeight: `${maxRows * 1.5}rem`,
              }}
            />
          )}

          {mode === "preview" && (
            <div
              className="px-3 py-2 min-h-[6rem] overflow-auto"
              style={{ maxHeight: `${maxRows * 1.5}rem` }}
            >
              {value ? (
                <MarkdownRenderer content={value} />
              ) : (
                <p className="text-muted-foreground text-sm italic">
                  Nothing to preview
                </p>
              )}
            </div>
          )}

          {mode === "help" && (
            <div
              className="px-3 py-2 overflow-auto"
              style={{ maxHeight: `${maxRows * 1.5}rem` }}
            >
              <MarkdownRenderer content={helpContent} />
            </div>
          )}
        </div>

        {/* Footer with character count */}
        <div className="flex items-center justify-end px-3 py-1.5 border-t bg-muted/20 text-xs">
          <span
            className={`font-mono ${
              charWarning === "error"
                ? "text-red-500 font-semibold"
                : charWarning === "warning"
                  ? "text-yellow-500"
                  : "text-muted-foreground"
            }`}
          >
            {charCount.toLocaleString()} / {maxLength.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
