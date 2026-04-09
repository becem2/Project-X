import {
  HashRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";

import * as Tooltip from "@radix-ui/react-tooltip";
import {
  Home,
  FolderOpen,
  Eye,
  Settings as SettingsIcon,
} from "lucide-react";

import StatusBar from "../Components/Layout/StatusBar";
import Projects from "../Components/Layout/MainView/Projects";
import Dashboard from "../Components/Layout/MainView/Dashboard";
import Viewer from "../Components/Layout/MainView/Viewer";
import Setting from "../Components/Layout/MainView/Settings";

function Sidebar() {
  const location = useLocation();

  const navItems = [
    { path: "/", label: "Dashboard", icon: Home },
    { path: "/projects", label: "Projects", icon: FolderOpen },
    { path: "/viewer", label: "Viewer", icon: Eye },
    { path: "/settings", label: "Settings", icon: SettingsIcon },
  ];

  return (
    <Tooltip.Provider delayDuration={200}>
      <div className="w-16 bg-gray-900 border-r border-gray-800 flex flex-col items-center py-4 gap-2">

        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <Tooltip.Root key={item.path}>
              <Tooltip.Trigger asChild>
                <Link
                  to={item.path}
                  className={`
                    w-12 h-12 rounded-lg flex items-center justify-center transition-all
                    ${
                      isActive
                        ? "bg-blue-600 text-white"
                        : "text-gray-400 hover:bg-gray-800 hover:text-white"
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                </Link>
              </Tooltip.Trigger>

              <Tooltip.Portal>
                <Tooltip.Content
                  side="right"
                  sideOffset={6}
                  className="bg-gray-800 text-white px-3 py-1 rounded-md text-sm shadow-lg border border-gray-700"
                >
                  {item.label}
                  <Tooltip.Arrow className="fill-gray-800" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          );
        })}

      </div>
    </Tooltip.Provider>
  );
}

function Layout() {
  return (
    <Router>
      <div className="flex h-screen w-screen">
        <Sidebar />

        
        <div className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/viewer" element={<Viewer />} />
            <Route path="/settings" element={<Setting />} />
          </Routes>
        </div>

      </div>

      {/* STATUS BAR */}
      <StatusBar />
    </Router>
  );
}

export default Layout;