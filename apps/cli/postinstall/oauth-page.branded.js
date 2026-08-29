// agentBrain Harness mark (see apps/web/public/favicon.svg). Replaces the pi-ai
// default logo so the shared OAuth callback page is agentBrain-branded across
// every provider flow (openai-codex, anthropic, xai, ...). Patched via pnpm patch.
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" aria-hidden="true"><rect x="1" y="1" width="38" height="38" rx="9" fill="#1f2126"/><g transform="translate(21.25 19.5) scale(1.34) translate(-21.25 -19.5)"><g stroke="#e8e8ea" stroke-linecap="round"><line x1="20" y1="20" x2="24.92" y2="22.54" stroke-opacity="0.32" stroke-width="0.76"/><line x1="20" y1="20" x2="11.13" y2="25.74" stroke-opacity="0.44" stroke-width="0.97"/><line x1="20" y1="20" x2="17.04" y2="30.73" stroke-opacity="0.36" stroke-width="0.81"/><line x1="20" y1="20" x2="22.71" y2="7.82" stroke-opacity="0.41" stroke-width="0.9"/><line x1="20" y1="20" x2="15.78" y2="14.29" stroke-opacity="0.32" stroke-width="0.77"/><line x1="20" y1="20" x2="29.2" y2="17.39" stroke-opacity="0.46" stroke-width="1"/><line x1="20" y1="20" x2="17.93" y2="25.56" stroke-opacity="0.31" stroke-width="0.76"/><line x1="20" y1="20" x2="25.36" y2="31.31" stroke-opacity="0.44" stroke-width="0.96"/><line x1="20" y1="20" x2="31.37" y2="13.83" stroke-opacity="0.4" stroke-width="0.88"/><line x1="24.92" y1="22.54" x2="17.93" y2="25.56" stroke-opacity="0.25" stroke-width="0.67"/><line x1="17.93" y1="25.56" x2="17.04" y2="30.73" stroke-opacity="0.29" stroke-width="0.72"/><line x1="17.04" y1="30.73" x2="25.36" y2="31.31" stroke-opacity="0.41" stroke-width="0.92"/><line x1="25.36" y1="31.31" x2="11.13" y2="25.74" stroke-opacity="0.5" stroke-width="1.08"/><line x1="11.13" y1="25.74" x2="29.2" y2="17.39" stroke-opacity="0.51" stroke-width="1.12"/><line x1="29.2" y1="17.39" x2="31.37" y2="13.83" stroke-opacity="0.47" stroke-width="1.03"/><line x1="31.37" y1="13.83" x2="15.78" y2="14.29" stroke-opacity="0.34" stroke-width="0.8"/><line x1="15.78" y1="14.29" x2="24.92" y2="22.54" stroke-opacity="0.25" stroke-width="0.68"/><line x1="22.71" y1="7.82" x2="31.37" y2="13.83" stroke-opacity="0.43" stroke-width="0.93"/><line x1="22.71" y1="7.82" x2="15.78" y2="14.29" stroke-opacity="0.35" stroke-width="0.82"/></g><g fill="#e8e8ea"><circle cx="17.93" cy="25.56" r="1.18" fill-opacity="0.54"/><circle cx="24.92" cy="22.54" r="1.19" fill-opacity="0.54"/><circle cx="15.78" cy="14.29" r="1.22" fill-opacity="0.56"/><circle cx="17.04" cy="30.73" r="1.37" fill-opacity="0.67"/><circle cx="20" cy="20" r="2.1" fill-opacity="0.75"/><circle cx="31.37" cy="13.83" r="1.61" fill-opacity="0.8"/><circle cx="22.71" cy="7.82" r="1.68" fill-opacity="0.84"/><circle cx="25.36" cy="31.31" r="1.89" fill-opacity="0.92"/><circle cx="11.13" cy="25.74" r="1.92" fill-opacity="0.93"/><circle cx="29.2" cy="17.39" r="2.04" fill-opacity="0.96"/></g></g></svg>`;
function escapeHtml(value) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}
function renderPage(options) {
    const title = escapeHtml(options.title);
    const heading = escapeHtml(options.heading);
    const message = escapeHtml(options.message);
    const details = options.details ? escapeHtml(options.details) : undefined;
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    :root {
      --text: #fafafa;
      --text-dim: #a1a1aa;
      --page-bg: #09090b;
      --font-sans: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    }
    * { box-sizing: border-box; }
    html { color-scheme: dark; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: var(--page-bg);
      color: var(--text);
      font-family: var(--font-sans);
      text-align: center;
    }
    main {
      width: 100%;
      max-width: 560px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .logo {
      width: 72px;
      height: 72px;
      display: block;
      margin-bottom: 24px;
    }
    h1 {
      margin: 0 0 10px;
      font-size: 28px;
      line-height: 1.15;
      font-weight: 650;
      color: var(--text);
    }
    p {
      margin: 0;
      line-height: 1.7;
      color: var(--text-dim);
      font-size: 15px;
    }
    .details {
      margin-top: 16px;
      font-family: var(--font-mono);
      font-size: 13px;
      color: var(--text-dim);
      white-space: pre-wrap;
      word-break: break-word;
    }
  </style>
</head>
<body>
  <main>
    <div class="logo">${LOGO_SVG}</div>
    <h1>${heading}</h1>
    <p>${message}</p>
    ${details ? `<div class="details">${details}</div>` : ""}
  </main>
</body>
</html>`;
}
export function oauthSuccessHtml(message) {
    return renderPage({
        title: "Authentication successful",
        heading: "Authentication successful",
        message,
    });
}
export function oauthErrorHtml(message, details) {
    return renderPage({
        title: "Authentication failed",
        heading: "Authentication failed",
        message,
        details,
    });
}
//# sourceMappingURL=oauth-page.js.map