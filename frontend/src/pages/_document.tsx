import { ColorSchemeScript } from "@mantine/core";
import Document, { Head, Html, Main, NextScript } from "next/document";

export default class _Document extends Document {
  render() {
    return (
      <Html>
        <Head>
          <ColorSchemeScript />
          {/* Standard browser tab icon */}
          <link rel="icon" type="image/x-icon" href="/img/favicon.ico" />

          {/* Keeps your private server off Google Search */}
          <meta name="robots" content="noindex" />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
