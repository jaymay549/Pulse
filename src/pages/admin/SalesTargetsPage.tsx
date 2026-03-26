import { SalesTargetsTab } from "@/components/admin/sales-targets/SalesTargetsTab";

const SalesTargetsPage = () => {
  return (
    <div className="w-full">
      <h1 className="text-xl font-bold text-zinc-100 mb-6">Sales Targets</h1>
      <SalesTargetsTab />
    </div>
  );
};

export default SalesTargetsPage;
