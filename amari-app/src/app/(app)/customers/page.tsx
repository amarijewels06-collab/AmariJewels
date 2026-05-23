import { PartyManager } from "@/components/forms/party-manager";

export default function CustomersPage() {
  return <PartyManager endpoint="/api/customers" kind="customers" title="Customers" />;
}
