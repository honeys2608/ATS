import { useEffect, useState } from "react";
import clientService from "../../services/clientService";

export default function ClientInvoices() {
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    clientService.getInvoices().then(setInvoices);
  }, []);

  return (
    <div className="bg-white rounded shadow">
      <table className="w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2">Invoice #</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((i) => (
            <tr key={i.id} className="border-t">
              <td className="p-2">{i.invoice_number}</td>
              <td>{i.amount}</td>
              <td>{i.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
