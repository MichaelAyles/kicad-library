/**
 * circuitsnips.com/* -> https://www.circuitsnips.com/* (308, path and query
 * kept). The main worker serves www; with a static site most requests are
 * answered from static assets without running its code, so the bare domain
 * gets this separate redirect worker instead.
 */
export default {
  fetch(request: Request): Response {
    const url = new URL(request.url);
    url.hostname = "www.circuitsnips.com";
    url.protocol = "https:";
    url.port = "";
    return Response.redirect(url.toString(), 308);
  },
};
