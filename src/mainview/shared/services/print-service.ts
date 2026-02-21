export type PrintDestination = "paper" | "pdf";

export interface PrintTableColumn<RowType> {
  formatValue: (row: RowType) => string;
  header: string;
}

interface PrintTableOptions<RowType> {
  columns: PrintTableColumn<RowType>[];
  destination: PrintDestination;
  emptyMessage?: string;
  generatedAt: string;
  rows: RowType[];
  subtitle?: string;
  title: string;
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildRowsMarkup = <RowType>({
  columns,
  emptyMessage,
  rows,
}: Pick<PrintTableOptions<RowType>, "columns" | "rows" | "emptyMessage">) => {
  if (rows.length === 0) {
    const message = escapeHtml(emptyMessage ?? "No rows available.");
    return `<tr><td colspan="${columns.length}">${message}</td></tr>`;
  }

  return rows
    .map((row) => {
      const cells = columns
        .map((column) => `<td>${escapeHtml(column.formatValue(row))}</td>`)
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
};

const toReadableDateTime = (isoDateText: string): string => {
  const dateValue = new Date(isoDateText);
  if (Number.isNaN(dateValue.getTime())) {
    return isoDateText;
  }

  return dateValue.toLocaleString();
};

export const printTable = <RowType>({
  columns,
  destination,
  emptyMessage,
  generatedAt,
  rows,
  subtitle,
  title,
}: PrintTableOptions<RowType>): void => {
  if (typeof window === "undefined") {
    throw new Error("Printing is only available in a browser context.");
  }

  const generatedAtLabel = toReadableDateTime(generatedAt);
  const heading = destination === "pdf" ? "PDF Export" : "Paper Print";
  const destinationHint =
    destination === "pdf"
      ? 'In the print dialog, select "Save as PDF".'
      : "In the print dialog, choose your destination printer.";

  const headerMarkup = columns
    .map((column) => `<th scope="col">${escapeHtml(column.header)}</th>`)
    .join("");

  const bodyMarkup = buildRowsMarkup({
    columns,
    rows,
    emptyMessage,
  });

  const documentMarkup = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font: 14px/1.4 "Segoe UI", Tahoma, Arial, sans-serif;
      color: #121212;
      background: #ffffff;
    }
    h1 { margin: 0 0 8px; font-size: 24px; }
    h2 { margin: 0 0 12px; font-size: 16px; color: #555; font-weight: 600; }
    p { margin: 0 0 8px; color: #444; }
    .meta { margin-bottom: 18px; }
    table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #999;
      font-size: 13px;
    }
    th, td {
      border: 1px solid #999;
      text-align: left;
      padding: 7px 8px;
      vertical-align: top;
    }
    th {
      background: #f3f3f3;
      font-weight: 600;
    }
    @page { margin: 12mm; }
  </style>
</head>
<body>
  <header class="meta">
    <h1>${escapeHtml(title)}</h1>
    ${subtitle ? `<h2>${escapeHtml(subtitle)}</h2>` : ""}
    <p>${escapeHtml(heading)}</p>
    <p>Generated: ${escapeHtml(generatedAtLabel)}</p>
    <p>${escapeHtml(destinationHint)}</p>
  </header>
  <table>
    <thead>
      <tr>${headerMarkup}</tr>
    </thead>
    <tbody>${bodyMarkup}</tbody>
  </table>
</body>
</html>`;

  const printFrame = document.createElement("iframe");
  printFrame.setAttribute("aria-hidden", "true");
  printFrame.style.position = "fixed";
  printFrame.style.right = "0";
  printFrame.style.bottom = "0";
  printFrame.style.width = "0";
  printFrame.style.height = "0";
  printFrame.style.border = "0";
  printFrame.style.visibility = "hidden";

  let isCleanedUp = false;
  const cleanup = (): void => {
    if (isCleanedUp) {
      return;
    }
    isCleanedUp = true;

    if (printFrame.parentNode) {
      printFrame.parentNode.removeChild(printFrame);
    }
  };

  document.body.appendChild(printFrame);

  const frameDocument = printFrame.contentDocument;
  const frameWindow = printFrame.contentWindow;
  if (!(frameDocument && frameWindow)) {
    cleanup();
    throw new Error("Unable to access print context.");
  }

  frameDocument.open();
  frameDocument.write(documentMarkup);
  frameDocument.close();

  frameWindow.addEventListener(
    "afterprint",
    () => {
      cleanup();
    },
    { once: true }
  );

  const handleFocusReturn = (): void => {
    window.setTimeout(() => {
      cleanup();
    }, 300);
  };
  window.addEventListener("focus", handleFocusReturn, { once: true });

  window.setTimeout(() => {
    frameWindow.focus();
    frameWindow.print();
  }, 50);
};
