import { useState } from "react";
import LoginPage from "./modules/login/LoginPage";
import { getCompanyAdmin } from "./modules/login/companyAuth";
import CollegePage from "./modules/canteens/college/CollegePage";
import ManagersPage from "./modules/managers/ManagersPage";
import Layout from "./components/Layout";

export default function App() {
  const [admin, setAdmin] = useState(getCompanyAdmin());
  const [activeTab, setActiveTab] = useState("colleges");

  if (!admin) {
    return <LoginPage onLoggedIn={setAdmin} />;
  }

  return (
    <Layout admin={admin} activeTab={activeTab} onTabChange={setActiveTab} onLogout={() => setAdmin(null)}>
      {activeTab === "colleges" ? <CollegePage /> : <ManagersPage />}
    </Layout>
  );
}
