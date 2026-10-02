"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import {
  Color,
  FontFamily,
  FontSize,
  LineHeight,
  TextStyle,
} from "@tiptap/extension-text-style";
import { TextAlign } from "@tiptap/extension-text-align";
import { Image as TiptapImage } from "@tiptap/extension-image";
import { Highlight } from "@tiptap/extension-highlight";
import { Placeholder } from "@tiptap/extensions";
import {
  ArrowUUpLeft,
  ArrowUUpRight,
  Code,
  Eraser,
  Highlighter,
  ImageSquare,
  LinkSimple,
  LinkBreak,
  ListBullets,
  ListNumbers,
  Minus,
  Palette,
  Quotes,
  TextAlignCenter,
  TextAlignJustify,
  TextAlignLeft,
  TextAlignRight,
  TextB,
  TextItalic,
  TextStrikethrough,
  TextUnderline,
  UploadSimple,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { API_URL, ApiError, api } from "@/lib/api";
import { isRichText } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

const UPLOAD_MAX_BYTES = 2 * 1024 * 1024;
const IMAGE_MAX_SIDE = 1600;

const FONT_FAMILIES = [
  { label: "Default", value: "" },
  { label: "Sans Serif", value: "Arial, Helvetica, sans-serif" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Monospace", value: "'Courier New', monospace" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Tahoma", value: "Tahoma, sans-serif" },
  { label: "Trebuchet", value: "'Trebuchet MS', sans-serif" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
];

const FONT_SIZES = ["12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px", "40px"];
const LINE_HEIGHTS = ["1", "1.15", "1.5", "1.75", "2"];

const TEXT_COLORS = [
  "#111827", "#536070", "#9ca3af", "#e11d48", "#ea580c", "#ca8a04",
  "#16a34a", "#0891b2", "#1e63ff", "#7c3aed", "#db2777", "#ffffff",
];
const HIGHLIGHT_COLORS = [
  "#fef08a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#fed7aa", "#e9d5ff", "#fecaca", "#e5e7eb",
];

const BLOCK_TYPES = [
  { value: "p", label: "Paragraf" },
  { value: "h1", label: "Judul 1" },
  { value: "h2", label: "Judul 2" },
  { value: "h3", label: "Judul 3" },
  { value: "blockquote", label: "Kutipan" },
  { value: "pre", label: "Blok kode" },
];

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Old plain-text descriptions open as paragraphs. */
function toEditorHtml(value: string): string {
  if (!value.trim() || isRichText(value)) return value;
  return value
    .split(/\n+/)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");
}

/** Large photos are scaled down and re-encoded so uploads stay under the API limit. */
async function prepareImage(file: File): Promise<Blob> {
  if (file.type === "image/gif" && file.size <= UPLOAD_MAX_BYTES) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= UPLOAD_MAX_BYTES) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.85),
  );
  if (!blob) throw new Error("Gagal memproses gambar.");
  return blob;
}

async function uploadImage(file: File): Promise<string> {
  const blob = await prepareImage(file);
  if (blob.size > UPLOAD_MAX_BYTES) throw new Error("Gambar maksimal 2 MB.");
  const form = new FormData();
  form.append("file", blob, file.name || "gambar");
  const { path } = await api<{ path: string }>("/admin/media", { method: "POST", body: form });
  return `${API_URL}${path}`;
}

function ToolbarButton({
  icon: ButtonIcon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: Icon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-md text-ink-soft",
        "transition-colors duration-150 hover:bg-mist hover:text-ink",
        "disabled:pointer-events-none disabled:opacity-40",
        active && "bg-action-wash text-action hover:bg-action-wash hover:text-action",
      )}
    >
      <ButtonIcon className="size-4" weight={active ? "bold" : "regular"} aria-hidden="true" />
    </button>
  );
}

function ToolbarSelect({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <select
      aria-label={label}
      title={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        "h-8 shrink-0 rounded-md border border-hairline bg-surface px-2 text-label text-ink",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action/25",
        className,
      )}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function Divider() {
  return <span aria-hidden="true" className="mx-0.5 h-5 w-px shrink-0 bg-hairline" />;
}

function ToolbarPopover({
  trigger,
  children,
  open,
  onOpenChange,
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          className={cn(
            "z-50 w-64 rounded-md border border-hairline bg-surface p-3 shadow-lifted",
            "data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out",
          )}
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

function ColorPopover({
  label,
  icon: TriggerIcon,
  colors,
  current,
  onPick,
  onClear,
}: {
  label: string;
  icon: Icon;
  colors: string[];
  current: string | null;
  onPick: (color: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <ToolbarPopover
      open={open}
      onOpenChange={setOpen}
      trigger={
        <button
          type="button"
          title={label}
          aria-label={label}
          onMouseDown={(event) => event.preventDefault()}
          className="inline-flex h-8 shrink-0 flex-col items-center justify-center rounded-md px-1.5 text-ink-soft transition-colors hover:bg-mist hover:text-ink"
        >
          <TriggerIcon className="size-4" aria-hidden="true" />
          <span
            aria-hidden="true"
            className="mt-0.5 h-1 w-4 rounded-full border border-hairline"
            style={{ backgroundColor: current ?? "transparent" }}
          />
        </button>
      }
    >
      <p className="mb-2 text-label font-bold text-ink">{label}</p>
      <div className="grid grid-cols-6 gap-1.5">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            title={color}
            aria-label={`${label} ${color}`}
            onClick={() => {
              onPick(color);
              setOpen(false);
            }}
            className={cn(
              "size-8 rounded-md border border-hairline transition-transform hover:scale-110",
              current?.toLowerCase() === color && "ring-2 ring-action ring-offset-1",
            )}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-label text-ink-soft">
          <input
            type="color"
            value={current && /^#[0-9a-f]{6}$/i.test(current) ? current : "#1e63ff"}
            onChange={(event) => onPick(event.target.value)}
            className="size-7 cursor-pointer rounded border border-hairline bg-transparent"
          />
          Warna lain
        </label>
        <button
          type="button"
          onClick={() => {
            onClear();
            setOpen(false);
          }}
          className="text-label font-bold text-action hover:underline"
        >
          Hapus
        </button>
      </div>
    </ToolbarPopover>
  );
}

function LinkPopover({ editor, active }: { editor: Editor; active: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [href, setHref] = React.useState("");

  function apply(event: React.FormEvent) {
    event.preventDefault();
    const url = href.trim();
    const chain = editor.chain().focus().extendMarkRange("link");
    if (!url) chain.unsetLink().run();
    else chain.setLink({ href: /^(https?:|mailto:)/i.test(url) ? url : `https://${url}` }).run();
    setOpen(false);
  }

  return (
    <ToolbarPopover
      open={open}
      onOpenChange={(next) => {
        if (next) setHref(String(editor.getAttributes("link").href ?? ""));
        setOpen(next);
      }}
      trigger={
        <button
          type="button"
          title="Tautan"
          aria-label="Tautan"
          aria-pressed={active}
          onMouseDown={(event) => event.preventDefault()}
          className={cn(
            "inline-flex size-8 shrink-0 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-mist hover:text-ink",
            active && "bg-action-wash text-action",
          )}
        >
          <LinkSimple className="size-4" aria-hidden="true" />
        </button>
      }
    >
      <form onSubmit={apply} className="space-y-2">
        <label className="block text-label font-bold text-ink" htmlFor="rte-link">
          Tautan
        </label>
        <input
          id="rte-link"
          autoFocus
          value={href}
          onChange={(event) => setHref(event.target.value)}
          placeholder="https://contoh.com"
          className="h-9 w-full rounded-md border border-hairline bg-surface px-2.5 text-body text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action/25"
        />
        <div className="flex justify-end gap-2">
          {active ? (
            <button
              type="button"
              onClick={() => {
                editor.chain().focus().extendMarkRange("link").unsetLink().run();
                setOpen(false);
              }}
              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-label font-bold text-refused-ink hover:bg-refused-wash"
            >
              <LinkBreak className="size-3.5" aria-hidden="true" />
              Lepas
            </button>
          ) : null}
          <button
            type="submit"
            className="rounded-md bg-action px-3 py-1.5 text-label font-bold text-white hover:bg-action-pressed"
          >
            Terapkan
          </button>
        </div>
      </form>
    </ToolbarPopover>
  );
}

function ImagePopover({ editor }: { editor: Editor }) {
  const [open, setOpen] = React.useState(false);
  const [url, setUrl] = React.useState("");
  const [alt, setAlt] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  function insert(src: string) {
    editor.chain().focus().setImage({ src, alt: alt.trim() || undefined }).run();
    setUrl("");
    setAlt("");
    setOpen(false);
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
      toast.error("Pilih file gambar PNG, JPG, GIF, atau WebP.");
      return;
    }
    setUploading(true);
    try {
      insert(await uploadImage(file));
    } catch (err) {
      toast.error("Gagal mengunggah gambar", {
        description: err instanceof ApiError || err instanceof Error ? err.message : "Coba lagi.",
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <ToolbarPopover
      open={open}
      onOpenChange={setOpen}
      trigger={
        <button
          type="button"
          title="Gambar"
          aria-label="Gambar"
          onMouseDown={(event) => event.preventDefault()}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-mist hover:text-ink"
        >
          <ImageSquare className="size-4" aria-hidden="true" />
        </button>
      }
    >
      <p className="text-label font-bold text-ink">Tambah gambar</p>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="sr-only"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
        className="mt-2 flex w-full flex-col items-center gap-1 rounded-md border border-dashed border-hairline bg-mist/40 px-3 py-4 text-label text-ink-soft transition-colors hover:border-action/40 hover:bg-action-wash/50 disabled:opacity-60"
      >
        <UploadSimple className="size-5 text-action" aria-hidden="true" />
        <span className="font-bold text-ink">{uploading ? "Mengunggah…" : "Unggah dari perangkat"}</span>
        <span>PNG, JPG, GIF, WebP · maks 2 MB</span>
      </button>
      <form
        className="mt-3 space-y-2 border-t border-hairline pt-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (/^https?:\/\//i.test(url.trim())) insert(url.trim());
          else toast.error("Masukkan URL gambar yang diawali https://");
        }}
      >
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="atau tempel URL gambar"
          aria-label="URL gambar"
          className="h-9 w-full rounded-md border border-hairline bg-surface px-2.5 text-body text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action/25"
        />
        <input
          value={alt}
          onChange={(event) => setAlt(event.target.value)}
          placeholder="Teks alternatif (opsional)"
          aria-label="Teks alternatif gambar"
          className="h-9 w-full rounded-md border border-hairline bg-surface px-2.5 text-body text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action/25"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!url.trim()}
            className="rounded-md bg-action px-3 py-1.5 text-label font-bold text-white hover:bg-action-pressed disabled:opacity-50"
          >
            Sisipkan
          </button>
        </div>
      </form>
    </ToolbarPopover>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const textStyle = e.getAttributes("textStyle");
      const block = e.isActive("heading", { level: 1 })
        ? "h1"
        : e.isActive("heading", { level: 2 })
          ? "h2"
          : e.isActive("heading", { level: 3 })
            ? "h3"
            : e.isActive("blockquote")
              ? "blockquote"
              : e.isActive("codeBlock")
                ? "pre"
                : "p";
      return {
        block,
        fontFamily: String(textStyle.fontFamily ?? ""),
        fontSize: String(textStyle.fontSize ?? ""),
        lineHeight: String(textStyle.lineHeight ?? ""),
        color: (textStyle.color as string | undefined) ?? null,
        highlight: (e.getAttributes("highlight").color as string | undefined) ?? null,
        bold: e.isActive("bold"),
        italic: e.isActive("italic"),
        underline: e.isActive("underline"),
        strike: e.isActive("strike"),
        code: e.isActive("code"),
        link: e.isActive("link"),
        bulletList: e.isActive("bulletList"),
        orderedList: e.isActive("orderedList"),
        align: (["left", "center", "right", "justify"] as const).find((a) =>
          e.isActive({ textAlign: a }),
        ),
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
      };
    },
  });

  const chain = () => editor.chain().focus();

  function setBlock(value: string) {
    if (value === "p") chain().setParagraph().run();
    else if (value === "blockquote") chain().setParagraph().toggleBlockquote().run();
    else if (value === "pre") chain().toggleCodeBlock().run();
    else chain().setHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 }).run();
  }

  const fontFamilyOptions = FONT_FAMILIES.some((f) => f.value === state.fontFamily)
    ? FONT_FAMILIES
    : [...FONT_FAMILIES, { label: state.fontFamily, value: state.fontFamily }];

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b border-hairline bg-surface/95 px-2 py-1.5 backdrop-blur">
      <ToolbarButton icon={ArrowUUpLeft} label="Urungkan" disabled={!state.canUndo} onClick={() => chain().undo().run()} />
      <ToolbarButton icon={ArrowUUpRight} label="Ulangi" disabled={!state.canRedo} onClick={() => chain().redo().run()} />
      <Divider />
      <ToolbarSelect label="Gaya paragraf" value={state.block} onChange={setBlock} options={BLOCK_TYPES} className="w-28" />
      <ToolbarSelect
        label="Jenis font"
        value={state.fontFamily}
        onChange={(value) => (value ? chain().setFontFamily(value).run() : chain().unsetFontFamily().run())}
        options={fontFamilyOptions}
        className="w-32"
      />
      <ToolbarSelect
        label="Ukuran font"
        value={state.fontSize}
        onChange={(value) => (value ? chain().setFontSize(value).run() : chain().unsetFontSize().run())}
        options={[
          { value: "", label: "Ukuran" },
          ...FONT_SIZES.map((size) => ({ value: size, label: size.replace("px", "") })),
          ...(state.fontSize && !FONT_SIZES.includes(state.fontSize)
            ? [{ value: state.fontSize, label: state.fontSize }]
            : []),
        ]}
        className="w-20"
      />
      <ToolbarSelect
        label="Spasi baris"
        value={state.lineHeight}
        onChange={(value) => (value ? chain().setLineHeight(value).run() : chain().unsetLineHeight().run())}
        options={[
          { value: "", label: "Spasi" },
          ...LINE_HEIGHTS.map((height) => ({ value: height, label: height })),
          ...(state.lineHeight && !LINE_HEIGHTS.includes(state.lineHeight)
            ? [{ value: state.lineHeight, label: state.lineHeight }]
            : []),
        ]}
        className="w-20"
      />
      <Divider />
      <ToolbarButton icon={TextB} label="Tebal" active={state.bold} onClick={() => chain().toggleBold().run()} />
      <ToolbarButton icon={TextItalic} label="Miring" active={state.italic} onClick={() => chain().toggleItalic().run()} />
      <ToolbarButton icon={TextUnderline} label="Garis bawah" active={state.underline} onClick={() => chain().toggleUnderline().run()} />
      <ToolbarButton icon={TextStrikethrough} label="Coret" active={state.strike} onClick={() => chain().toggleStrike().run()} />
      <ToolbarButton icon={Code} label="Kode" active={state.code} onClick={() => chain().toggleCode().run()} />
      <ColorPopover
        label="Warna teks"
        icon={Palette}
        colors={TEXT_COLORS}
        current={state.color}
        onPick={(color) => chain().setColor(color).run()}
        onClear={() => chain().unsetColor().run()}
      />
      <ColorPopover
        label="Stabilo"
        icon={Highlighter}
        colors={HIGHLIGHT_COLORS}
        current={state.highlight}
        onPick={(color) => chain().setHighlight({ color }).run()}
        onClear={() => chain().unsetHighlight().run()}
      />
      <Divider />
      <ToolbarButton icon={TextAlignLeft} label="Rata kiri" active={state.align === "left"} onClick={() => chain().setTextAlign("left").run()} />
      <ToolbarButton icon={TextAlignCenter} label="Rata tengah" active={state.align === "center"} onClick={() => chain().setTextAlign("center").run()} />
      <ToolbarButton icon={TextAlignRight} label="Rata kanan" active={state.align === "right"} onClick={() => chain().setTextAlign("right").run()} />
      <ToolbarButton icon={TextAlignJustify} label="Rata kiri-kanan" active={state.align === "justify"} onClick={() => chain().setTextAlign("justify").run()} />
      <Divider />
      <ToolbarButton icon={ListBullets} label="Daftar poin" active={state.bulletList} onClick={() => chain().toggleBulletList().run()} />
      <ToolbarButton icon={ListNumbers} label="Daftar nomor" active={state.orderedList} onClick={() => chain().toggleOrderedList().run()} />
      <ToolbarButton icon={Quotes} label="Kutipan" active={state.block === "blockquote"} onClick={() => chain().toggleBlockquote().run()} />
      <ToolbarButton icon={Minus} label="Garis pemisah" onClick={() => chain().setHorizontalRule().run()} />
      <Divider />
      <LinkPopover editor={editor} active={state.link} />
      <ImagePopover editor={editor} />
      <ToolbarButton
        icon={Eraser}
        label="Hapus format"
        onClick={() => chain().unsetAllMarks().clearNodes().unsetTextAlign().run()}
      />
    </div>
  );
}

/** WYSIWYG editor for service descriptions; emits HTML (the API sanitizes it). */
export function RichTextEditor({
  id,
  value,
  onChange,
  placeholder,
  invalid,
  className,
}: {
  id?: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  invalid?: boolean;
  className?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      LineHeight,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TiptapImage.configure({ allowBase64: false }),
      Placeholder.configure({ placeholder: placeholder ?? "Tulis deskripsi layanan…" }),
    ],
    content: toEditorHtml(value),
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        class: "rich-content px-4 py-3",
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? "" : e.getHTML()),
  });

  return (
    <div
      className={cn(
        "rich-editor overflow-hidden rounded-md border bg-surface",
        "focus-within:border-action focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-action)_18%,transparent)]",
        invalid ? "border-refused-edge" : "border-hairline",
        className,
      )}
    >
      {editor ? <Toolbar editor={editor} /> : <div className="h-11 border-b border-hairline bg-mist/40" />}
      <div className="max-h-[28rem] overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
