import "./globals.css";

export const metadata = {
  title: "Prospecting Fanatical — Rats d'Égouts",
  description: "CRM de prospection interne — cabinet OVC Assurance",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
