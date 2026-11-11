import { useRef, useState } from 'react';
import { useAssessment } from '../../context/assessmentContext.js';
import { CHOICES, COLS, COND, COUNTRY_OPTIONS, DEFAULT_COLS, DETAIL, OTHER_OPTION } from '../../data/questionnaire.js';
import { isRequired } from '../../lib/assessmentProgress.js';
import { Check } from './SimpleShell.jsx';
import clsx from '../../lib/clsx.js';
import { ACCEPT_ATTR } from '../../lib/files.js';
import { inputIdFor, LABELLED_TYPES } from '../../lib/itemFields.js';
import { itemAnchor } from '../../lib/routes.js';

/**
 * One question as one white card (VendorSimpleForm.dc.html): title with a red * when required,
 * help text, then the answer control.
 */
export default function SimpleQuestion({ item }) {
  const { isItemLocked } = useAssessment();
  const locked = isItemLocked(item.ref);
  const id = inputIdFor(item.ref);
  // Text-like types label their single input; a file question labels its "Add file" button.
  const labelled = LABELLED_TYPES.has(item.t) || item.t === 'f';
  const Title = labelled ? 'label' : 'p';

  return (
    <div id={itemAnchor(item.ref)} className="vs-card scroll-mt-6 px-7 py-[22px] flex flex-col gap-3">
      <div>
        <Title htmlFor={labelled ? id : undefined} className="block font-medium">
          {item.title}
          {isRequired(item) && <span className="text-error"> *</span>}
        </Title>
        {item.help && <p className="text-14 text-stone mt-0.5">{item.help}</p>}
      </div>
      {/* A disabled fieldset makes the answer read-only after submission. */}
      <fieldset disabled={locked} className="m-0 p-0 border-0 min-w-0 flex flex-col gap-3">
        <Answer item={item} id={id} locked={locked} />
      </fieldset>
    </div>
  );
}

function Answer({ item, id, locked }) {
  const { answers, updateItem } = useAssessment();
  const e = answers[item.ref] || {};
  const set = (patch) => updateItem(item.ref, patch);
  const onText = (ev) => set({ v: ev.target.value });

  switch (item.t) {
    case 't':
      return <input id={id} className="vs-line" value={e.v || ''} onChange={onText} placeholder="Your answer" />;
    case 'n':
      return <input id={id} type="number" min="0" className="vs-line max-w-[200px]" value={e.v || ''} onChange={onText} placeholder="Your answer" />;
    case 'd':
      return <input id={id} type="date" className="vs-line max-w-[220px]" value={e.v || ''} onChange={onText} />;
    case 'l':
      return <textarea id={id} className="vs-box" rows={3} value={e.v || ''} onChange={onText} placeholder="Your answer" />;
    case 's':
      return (
        <select id={id} className="vs-box max-w-[280px]" value={e.v || ''} onChange={onText}>
          <option value="">Choose</option>
          {COUNTRY_OPTIONS.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      );
    case 'c':
      return <Choices item={item} entry={e} set={set} />;
    case 'y':
      return <YesNo item={item} entry={e} set={set} id={id} />;
    case 'r':
      return <Rows item={item} entry={e} set={set} locked={locked} />;
    case 'f':
      return <FileField item={item} id={id} locked={locked} />;
    default:
      return null;
  }
}

const optionRow = 'flex gap-3 items-center min-h-10 cursor-pointer';

function Choices({ item, entry, set }) {
  const selected = entry.c || [];
  const toggle = (label) => set({ c: selected.includes(label) ? selected.filter((x) => x !== label) : [...selected, label] });
  return (
    <>
      <div role="group" aria-label={item.title} className="flex flex-col gap-1">
        {(CHOICES[item.ref] || []).map((label) => (
          <label key={label} className={optionRow}>
            <input type="checkbox" className="vs-check" checked={selected.includes(label)} onChange={() => toggle(label)} />
            {label}
          </label>
        ))}
      </div>
      {selected.includes(OTHER_OPTION) && (
        <input
          className="vs-line"
          aria-label="Other type of organisation"
          placeholder="Please explain"
          value={entry.other || ''}
          onChange={(ev) => set({ other: ev.target.value })}
        />
      )}
    </>
  );
}

function YesNo({ item, entry, set, id }) {
  const detailPrompt = DETAIL[item.ref];
  const showDetail = entry.v === 'Yes' && !!detailPrompt && !COND[item.ref];
  return (
    <>
      <div role="radiogroup" aria-label={item.title} className="flex flex-col gap-1">
        {['Yes', 'No'].map((value) => (
          <label key={value} className={optionRow}>
            <input type="radio" name={`yn-${id}`} className="vs-check" checked={entry.v === value} onChange={() => set({ v: value })} />
            {value}
          </label>
        ))}
      </div>
      {showDetail && (
        <div>
          <label htmlFor={`d-${id}`} className="block text-14 text-stone mb-1.5">
            {detailPrompt}
          </label>
          <textarea id={`d-${id}`} className="vs-box" rows={3} value={entry.detail || ''} onChange={(ev) => set({ detail: ev.target.value })} />
        </div>
      )}
    </>
  );
}

function XIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function Rows({ item, entry, set, locked }) {
  const cols = COLS[item.ref] || DEFAULT_COLS;
  const rows = entry.rows && entry.rows.length ? entry.rows : [cols.map(() => '')];
  const change = (ri, ci, value) => set({ rows: rows.map((r, i) => (i === ri ? cols.map((_, j) => (j === ci ? value : r[j] || '')) : r)) });
  return (
    <div className="flex flex-col gap-3.5">
      {rows.map((r, ri) => (
        <div key={ri} className="flex flex-wrap gap-x-4 gap-y-2 items-end">
          {cols.map((c, ci) => (
            <input
              key={c}
              className="vs-line !w-auto flex-[1_1_160px] min-w-0"
              aria-label={`${c} ${ri + 1}`}
              placeholder={c}
              value={r[ci] || ''}
              onChange={(ev) => change(ri, ci, ev.target.value)}
            />
          ))}
          {!locked && (
            <button type="button" className="vs-chip-x" aria-label="Remove this entry" onClick={() => set({ rows: rows.filter((_, j) => j !== ri) })}>
              <XIcon />
            </button>
          )}
        </div>
      ))}
      {!locked && (
        <div>
          <button type="button" className="vs-link" onClick={() => set({ rows: [...rows, cols.map(() => '')] })}>
            + Add another
          </button>
        </div>
      )}
    </div>
  );
}

function FileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" className="flex-none text-stone">
      <path d="M14 3H6v18h12V7zM14 3v4h4" />
    </svg>
  );
}

/** Small name tag; removable when `onRemove` is given, otherwise it can show a short note. */
function Chip({ name, url, extra, note, onRemove, removeLabel }) {
  return (
    <span
      className={clsx(
        'inline-flex gap-2 items-center max-w-full min-h-[38px] border border-sand rounded-md bg-white text-14 py-1 pl-2.5',
        onRemove ? 'pr-1' : 'pr-2.5',
      )}
    >
      <FileIcon />
      {url ? (
        <a href={url} className="[overflow-wrap:anywhere] text-inherit" title={`Download ${name}`}>
          {name}
        </a>
      ) : (
        <span className="[overflow-wrap:anywhere]">{name}</span>
      )}
      {extra && <span className="text-13 text-stone no-underline">{extra}</span>}
      {note && !onRemove && <span className="text-12 text-stone">{note}</span>}
      {onRemove && (
        <button type="button" className="vs-chip-x" aria-label={removeLabel || `Remove ${name}`} onClick={onRemove}>
          <XIcon size={14} />
        </button>
      )}
    </span>
  );
}

/**
 * File question: "TracTrac already has this document", the vendor's files (name tags; "Checked by TracTrac" once reviewed),
 * "Add file" / "Add another file", and the "This doesn't apply to us" link with its reason box.
 * A file can be removed (and so replaced) until TracTrac marks it as reviewed.
 */
function FileField({ item, id, locked }) {
  const { answers, updateItem, uploads, uploadErrors, startUploads, cancelUpload, clearUploadErrors, removeFile } = useAssessment();
  const fileInput = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const ref = item.ref;
  const e = answers[ref] || {};
  const files = e.files || [];
  const running = uploads[ref] || [];
  const errors = uploadErrors[ref] || [];

  const canAdd = !locked && !e.tt && !e.na;
  const canNa = canAdd && files.length === 0 && running.length === 0;

  const browse = () => {
    clearUploadErrors(ref);
    fileInput.current?.click();
  };
  const onPicked = (ev) => {
    if (ev.target.files?.length) startUploads(ref, ev.target.files);
    ev.target.value = ''; // allow picking the same file again
  };
  const drop = canAdd
    ? {
        onDragOver: (ev) => {
          ev.preventDefault();
          setDragOver(true);
        },
        onDragLeave: () => setDragOver(false),
        onDrop: (ev) => {
          ev.preventDefault();
          setDragOver(false);
          if (ev.dataTransfer.files?.length) startUploads(ref, ev.dataTransfer.files);
        },
      }
    : {};

  return (
    <div {...drop} className={clsx('flex flex-col gap-3 rounded-md', dragOver && 'outline-dashed outline-2 outline-offset-4 outline-ink')}>
      <input ref={fileInput} type="file" multiple accept={ACCEPT_ATTR} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={onPicked} />

      {e.tt && (
        <p className="text-14 flex gap-2 items-center bg-sand-50 rounded-md px-3 py-2.5">
          <Check />
          TracTrac already has this document. Nothing to do here.
        </p>
      )}

      {(files.length > 0 || running.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {files.map((f, idx) => (
            <Chip
              key={`${f.name}-${idx}`}
              name={f.name}
              url={f.url}
              // Removable (and so replaceable) until TracTrac marks it as reviewed.
              note={f.reviewed ? 'Checked by TracTrac' : undefined}
              onRemove={!locked && !f.reviewed ? () => removeFile(ref, idx) : undefined}
            />
          ))}
          {running.map((u) => (
            <Chip key={u.id} name={u.name} extra={`${u.pct}%`} onRemove={() => cancelUpload(u.id)} removeLabel={`Stop uploading ${u.name}`} />
          ))}
        </div>
      )}

      {!locked &&
        errors.map((err) => (
          <p key={err.id} role="alert" className="text-14 text-error">
            {err.name}: {err.message}
          </p>
        ))}

      {e.na && (
        <div>
          <label htmlFor={`na-${id}`} className="block text-14 text-stone">
            Why doesn&apos;t this apply to you?
          </label>
          <input
            id={`na-${id}`}
            className="vs-line"
            value={e.why || ''}
            onChange={(ev) => updateItem(ref, { why: ev.target.value })}
            placeholder="Short explanation"
          />
          {!locked && (
            <button type="button" className="vs-link mt-2" onClick={() => updateItem(ref, { na: false, why: '' })}>
              I&apos;ll upload a file instead
            </button>
          )}
        </div>
      )}

      {canAdd && (
        <div className="flex flex-wrap gap-x-5 gap-y-3 items-center">
          <button type="button" id={id} className="vs-btn vs-btn-sm vs-btn-outline" onClick={browse}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 16V4M7 9l5-5 5 5M4 17v3h16v-3" />
            </svg>
            {files.length ? 'Add another file' : 'Add file'}
          </button>
          {canNa && (
            <button type="button" className="vs-link" onClick={() => updateItem(ref, { na: true })}>
              This doesn&apos;t apply to us
            </button>
          )}
        </div>
      )}
    </div>
  );
}
