# Inspection image fixtures

- `iphone-12-portrait.heic`: public iPhone 12 Pro portrait HEIC fixture from
  `https://heic.digital/download-sample/greyhounds-looking-for-a-table.heic`.
  The provider permits unrestricted testing and development use.
- `landscape.heic`: public 1440x960 landscape HEIC fixture from Nokia's HEIF
  sample collection at
  `https://raw.githubusercontent.com/nokiatech/heif/gh-pages/content/images/crowd_1440x960.heic`.
- `exif-landscape-6.jpg`: EXIF orientation 6 fixture from
  `https://github.com/recurser/exif-orientation-examples/blob/master/Landscape_6.jpg`.

These inputs are used only by local/CI browser tests. The application output is
canvas-encoded JPEG, so source EXIF/GPS metadata is not copied to stored evidence.
