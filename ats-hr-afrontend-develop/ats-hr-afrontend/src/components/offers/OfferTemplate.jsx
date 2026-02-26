// src/components/offers/OfferTemplate.jsx

export default function OfferTemplate({ candidate, offer }) {
  if (!candidate) {
    return (
      <div className="p-6 border rounded text-gray-500">
        Select candidate to preview offer letter
      </div>
    );
  }

  return (
    <div className="p-8 bg-white border rounded text-sm leading-6">
      {/* Company Header */}
      <div className="mb-6">
        <h2 className="text-lg font-bold">ASUUKI PRIVATE LIMITED</h2>
        <p>
          Off# 216, Prajay Corporate House, 1-10-64, Chikoti Gardens, Begumpet,
          Hyderabad, Telangana – 500016
        </p>
        <p>www.asuuki.com | hr@asuuki.com</p>
      </div>

      {/* Date */}
      <p className="mb-4">
        <b>Date:</b> {new Date().toLocaleDateString()}
      </p>

      {/* Candidate */}
      <p className="mb-4">
        <b>Dear {candidate.full_name},</b>
      </p>

      {/* Fixed Letter Content */}
      <p>Welcome to Asuuki Private Limited!</p>

      <p>
        We have greatly enjoyed our recent discussions with you and are pleased
        to offer you the role of <b>{offer.job_title}</b> with Asuuki Private
        Limited ("Asuuki"). Your place of posting will be{" "}
        <b>{offer.work_location}</b>.
      </p>

      <p>
        Your Annual Gross remuneration package inclusive of all perks and
        details of your salary package is mentioned in Annexure – ‘A’ of this
        letter. Your total CTC will be{" "}
        <b>
          {offer.currency} {offer.compensation}
        </b>
        .
      </p>

      <p>
        You are expected to join on <b>{offer.start_date}</b>. If you are unable
        to join by this date, please notify us immediately to seek an extension.
      </p>

      <p>
        You will be on probation for a period of <b>{offer.probation_period}</b>{" "}
        from your joining date. During probation, your employment may be
        terminated by either party with one month’s notice.
      </p>

      <p>
        You are required to maintain the confidentiality of company information,
        and any work developed during employment remains the intellectual
        property of the company.
      </p>

      <p>
        At the time of joining, you need to bring the documents mentioned in
        Annexure ‘B’ for verification.
      </p>

      <p>
        Please sign the duplicate copy of this letter in token of your
        acceptance of the above on or before <b>{offer.acceptance_deadline}</b>.
      </p>

      <p className="mt-6">
        We look forward to working with you and wish you success in your career
        with us.
      </p>

      {/* Footer */}
      <p className="mt-6">
        For Asuuki Private Limited,
        <br />
        <b>Shekhar Singh</b>
        <br />
        HR Manager
      </p>
    </div>
  );
}
