swank
=====

Stupid simple static webserver I whipped up in 30 minutes. If you want to test local static
files (HTML, JS, CSS), simply run swank.

Install
-------
    npm install -g swank

Depends on connect.

ngrok
-----

`swank` now has optional [ngrok](https://www.npmjs.org/package/ngrok) support. Just use the `--ngrok` flag
to expose your local machine to the wider internet.

Usage
-----
    swank [[--ngrok]] [[--port=PORT]] [[root_directory]]

Defaults to using current working directory and port 8000.
