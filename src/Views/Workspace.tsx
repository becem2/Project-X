import { HashRouter as Router, Routes, Route } from "react-router-dom";

import Sidebar from "../Components/Layout/Sidebar";
import StatusBar from "../Components/Layout/StatusBar";
import Projects from "../Components/Layout/MainView/Projects";
import Dashboard from "../Components/Layout/MainView/Dashboard";
import Viewer from "../Components/Layout/MainView/Viewer";
import Setting from "../Components/Layout/MainView/Settings";
import NewProject  from "../Components/Layout/MainView/NewProject";
import OpenProject from "../Components/Layout/MainView/OpenProject";
import Processing from "../Components/Layout/MainView/Processing";

function Layout() {
  return (
    <Router>
      {/* MAIN WRAPPER: 
        flex-col stacks the Workspace and StatusBar.
        h-screen overflow-hidden prevents the body from scrolling.
      */}
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-background">
        
        {/* WORKSPACE AREA: 
          flex-1 makes this container grow to fill all available space 
          above the status bar.
        */}
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />

          {/* CONTENT VIEW: 
            overflow-auto ensures only the route content scrolls 
            if it becomes too long.
          */}
          <main className="flex-1 overflow-auto bg-background">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/viewer" element={<Viewer />} />
              <Route path="/viewer/:projectId" element={<Viewer />} />
              <Route path="/settings" element={<Setting />} />
              <Route path="/newproject" element={<NewProject/>}/>
              <Route path="/openproject" element={<OpenProject/>}/>
              <Route path="/processing" element={<Processing/>} />
              <Route path="/processing/:projectId" element={<Processing/>} />
            </Routes>
          </main>
        </div>
        <StatusBar />
      </div>
    </Router>
  );
}

export default Layout;