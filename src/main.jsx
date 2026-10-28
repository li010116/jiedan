import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import "./scrollbars.css";

const AdminApp = lazy(() => import("./admin/AdminApp"));
const App = lazy(() => import("./App"));
const isAdmin = window.location.pathname === "/admin" || window.location.pathname.startsWith("/admin/");
document.documentElement.classList.add("js");

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Suspense fallback={<p role="status" style={{ padding: 32 }}>正在加载{isAdmin ? "工作台" : "网站"}…</p>}>
      {isAdmin ? <AdminApp /> : <App />}
    </Suspense>
  </React.StrictMode>,
);
