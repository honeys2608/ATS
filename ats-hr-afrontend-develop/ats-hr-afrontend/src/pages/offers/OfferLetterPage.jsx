// src/pages/offers/OfferLetterPage.jsx

import { useState } from "react";
import OfferLetter from "../OfferLetter";
import OfferTemplate from "../../components/offers/OfferTemplate";
import { sendOffer } from "../../services/offerService";

export default function OfferLetterPage({ candidate, onClose }) {
  const [offerData, setOfferData] = useState({});

  async function handleSend(payload) {
    await sendOffer(payload);
    alert("Offer letter sent successfully");
    onClose?.();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* LEFT: FORM */}
      <OfferLetter
        candidate={candidate}
        onClose={onClose}
        setExternalForm={setOfferData}
        onSubmit={handleSend}
      />

      {/* RIGHT: PREVIEW */}
      <OfferTemplate candidate={candidate} offer={offerData} />
    </div>
  );
}
