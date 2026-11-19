import { docsScript } from './security';

const configuration = {
  agent: { disabled: true },
  hideClientButton: true,
  showDeveloperTools: 'never',
  url: '/api/openapi.json',
};

export const docsPage = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lab API</title>
</head>
<body>
<div id="app"></div>
<script crossorigin="anonymous" integrity="${docsScript.integrity}" src="${docsScript.src}"></script>
<script>Scalar.createApiReference('#app', ${JSON.stringify(configuration)})</script>
</body>
</html>`;
