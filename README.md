# Parking Card Maker

A local web app for creating editable parking cards and printing them as A4 sheets.

## Run

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://127.0.0.1:5173/`.

## Import Data

Upload a `.xlsx` or `.csv` file with columns named `Name` and `Car Number`. Similar headings like `Full Name`, `Plate Number`, or `Registration Number` are also recognized. If no headings are found, the first column is treated as the name and the second as the car number.

Card numbers start from the current start number and increase automatically. Imported cards are auto-saved to the local database for the selected company.

For `Alexander House`, uploads can also include `Card No.` and `Exp. Date` columns. Card numbers are kept as `AH59` through `AH139`, including the special `AH81A` card, and any additional cards use `Zone B`.

Use the `Duplicate` button on a card row when recreating a lost card. The card keeps the same number and prints with a `Duplicate` watermark.

## Database

The app uses Convex when `VITE_CONVEX_URL` is configured. Without that environment variable, it falls back to browser local storage for local-only use. Each record keeps:

- Company header
- Card number
- Name
- Car number
- Expiry date
- Duplicate status
- Page number

Use the left company panel for `Alexander House`, `Desroches`, `JPH`, or `Lavoquer`. Filled cards are auto-saved when imported or edited, replacing existing records for the same company and card number instead of creating duplicates. The search field looks up saved records by card number, name, or car number.

Each company uses its built-in logo from `public/logos`, and the printed card header is logo-only.

Local fallback data is saved in browser local storage for `http://127.0.0.1:5173` under the key `parking-card-database-v1`. It is not written to a project file.

## Deploy

For production, deploy the Convex backend first and set `VITE_CONVEX_URL` in the Vercel project environment. Convex deploy can set the URL while building:

```bash
npx convex deploy --cmd "npm run build" --cmd-url-env-var-name VITE_CONVEX_URL
```

## Print Layout

The print stylesheet uses A4 portrait with a centered `17cm x 27cm` sheet:

- 2 columns x 3 rows
- 6 cards per page
- Each card is `8.5cm x 9cm`, matching the requested total sheet size

The preview shows one page at a time with previous and next arrows. Printing still prints all generated pages.

Use `Parking Back` in the left sidebar to switch the preview to the back side of the cards. It keeps the same A4, 6-card layout and prints the two management notice lines without names, card numbers, expiry dates, or logos.

`Ink saver` is on by default beside the print controls. It removes color fills from the printable cards while keeping each company logo in its original color.
