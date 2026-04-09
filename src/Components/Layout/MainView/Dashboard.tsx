import { Link } from "react-router";
import { motion } from "framer-motion";
import RecentProjectCard from "../../DashboardView/RecentProjectCard";
import StatCard from "../../DashboardView/StatCard";
import {
  Plus,
  FolderOpen,
  Upload,
  Clock,
  CheckCircle,
  Zap,
  Target,
  Award,
  ArrowRight,
  Sparkles,
  Activity,
  Folder,
} from "lucide-react";

const recentProjects = [
  {
    id: "1",
    name: "Downtown Survey 2024",
    thumbnail:
      "https://images.unsplash.com/photo-1720599548623-6c0eb0535031?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhZXJpYWwlMjBkcm9uZSUyMGxhbmRzY2FwZSUyMG1hcHBpbmd8ZW58MXx8fHwxNzcyMTU4OTUxfDA&ixlib=rb-4.1.0&q=80&w=400",
    status: "Completed",
    progress: 100,
    date: "2 hours ago",
    images: 247,
  },
  {
    id: "2",
    name: "Highway Construction",
    thumbnail:
      "https://images.unsplash.com/photo-1628155849837-648cf206ec31?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjBzaXRlJTIwc3VydmV5fGVufDF8fHx8MTc3MjE1ODk1Mnww&ixlib=rb-4.1.0&q=80&w=400",
    status: "Processing",
    progress: 67,
    date: "5 hours ago",
    images: 189,
  },
  {
    id: "3",
    name: "Terrain Analysis",
    thumbnail:
      "https://images.unsplash.com/photo-1649305915837-c907a85cfe4b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHwzZCUyMHRlcnJhaW4lMjBvcnRob3Bob3RvfGVufDF8fHx8MTc3MjE1ODk1Mnww&ixlib=rb-4.1.0&q=80&w=400",
    status: "Completed",
    progress: 100,
    date: "Yesterday",
    images: 312,
  },
  {
    id: "4",
    name: "Urban Planning Site",
    thumbnail:
      "https://images.unsplash.com/photo-1720599548623-6c0eb0535031?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhZXJpYWwlMjBkcm9uZSUyMGxhbmRzY2FwZSUyMG1hcHBpbmd8ZW58MXx8fHwxNzcyMTU4OTUxfDA&ixlib=rb-4.1.0&q=80&w=400",
    status: "Pending",
    progress: 0,
    date: "2 days ago",
    images: 156,
  },
];

const activities = [
  {
    action: "Processing completed",
    project: "Downtown Survey 2024",
    time: "2 hours ago",
    icon: CheckCircle,
    color: "text-primary",
  },
  {
    action: "New images imported",
    project: "Highway Construction",
    time: "3 hours ago",
    icon: Upload,
    color: "text-blue-500",
  },
  {
    action: "Project created",
    project: "Terrain Analysis",
    time: "Yesterday",
    icon: Plus,
    color: "text-purple-500",
  },
  {
    action: "Export completed",
    project: "Mining Site Survey",
    time: "2 days ago",
    icon: CheckCircle,
    color: "text-primary",
  },
];

function Dashboard() {
  return (
    <div className="h-full overflow-auto">
      {/* Hero Section */}
      <div className="relative px-8 py-12 border-b border-border bg-gradient-to-br from-primary/5 via-background to-background overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary rounded-full blur-3xl" />
        </div>

        <div className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="text-sm text-primary font-medium">
                Welcome back
              </span>
            </div>
            <h1 className="text-4xl font-bold mb-3">
              Good afternoon, Engineer
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl">
              Your photogrammetry workspace is ready. Start a
              new project or continue where you left off.
            </p>

            {/* Quick Stats */}
            <div className="grid grid-cols-4 gap-4">
              <StatCard
                icon={Folder}
                label="Total Projects"
                value="24"
                trend="+3 this week"
                color="bg-primary/10 text-primary"
              />
              <StatCard
                icon={Clock}
                label="In Progress"
                value="3"
                trend="Active now"
                color="bg-yellow-500/10 text-yellow-500"
              />
              <StatCard
                icon={CheckCircle}
                label="Completed"
                value="19"
                trend="79% success rate"
                color="bg-primary/10 text-primary"
              />
              <StatCard
                icon={Zap}
                label="Processing Speed"
                value="2.4x"
                trend="Faster than average"
                color="bg-blue-500/10 text-blue-500"
              />
            </div>
          </motion.div>
        </div>
      </div>

      <div className="px-8 py-8">
        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-10"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold mb-1">
                Quick Actions
              </h2>
              <p className="text-sm text-muted-foreground">
                Start your workflow in seconds
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <Link to="/dashboard/new-project">
              <motion.div
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                className="relative group overflow-hidden bg-gradient-to-br from-primary to-primary/80 rounded-xl p-6 shadow-lg hover:shadow-2xl transition-all"
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.1),transparent)]" />
                <div className="relative z-10">
                  <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Plus className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Create New Project
                  </h3>
                  <p className="text-sm text-white/80 mb-4">
                    Start a new photogrammetry project from
                    scratch
                  </p>
                  <div className="flex items-center gap-2 text-white font-medium">
                    <span>Get Started</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </motion.div>
            </Link>

            <Link to="/dashboard/open-project">
              <motion.div
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                className="relative group overflow-hidden bg-card border border-border rounded-xl p-6 hover:border-primary/50 hover:shadow-lg transition-all"
              >
                <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <FolderOpen className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  Open Project
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Continue working on existing projects
                </p>
                <div className="flex items-center gap-2 text-primary font-medium">
                  <span>Browse Projects</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.div>
            </Link>

            <Link to="/dashboard/import-images">
              <motion.div
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                className="relative group overflow-hidden bg-card border border-border rounded-xl p-6 hover:border-primary/50 hover:shadow-lg transition-all"
              >
                <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Upload className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  Import Images
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload drone images for processing
                </p>
                <div className="flex items-center gap-2 text-primary font-medium">
                  <span>Upload Now</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.div>
            </Link>
          </div>
        </motion.div>

        <div className="grid grid-cols-3 gap-8">
          {/* Recent Projects */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="col-span-2"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold mb-1">
                  Recent Projects
                </h2>
                <p className="text-sm text-muted-foreground">
                  Your latest work
                </p>
              </div>
              <Link
                to="/dashboard/projects"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                View All
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="space-y-4">
              {recentProjects.map((project, index) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.4,
                    delay: 0.4 + index * 0.1,
                  }}
                >
                  <RecentProjectCard project={project} />
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Activity Feed & Tips */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="space-y-6"
          >
            {/* Recent Activity */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">
                  Recent Activity
                </h2>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                {activities.map((activity, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 pb-3 last:pb-0 border-b border-border last:border-0"
                  >
                    <div
                      className={`w-8 h-8 rounded-lg bg-card flex items-center justify-center flex-shrink-0 ${activity.color}`}
                    >
                      <activity.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {activity.action}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {activity.project}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {activity.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pro Tips */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">
                  Pro Tips
                </h2>
              </div>
              <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-5">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                    <Award className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">
                      Optimize Image Overlap
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Maintain 70-80% overlap between images for
                      best reconstruction results.
                    </p>
                  </div>
                </div>
                <button className="w-full py-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg transition-colors">
                  Learn More
                </button>
              </div>
            </div>

            {/* Storage Usage */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  Storage
                </h2>
                <span className="text-sm text-muted-foreground">
                  18.4 GB / 50 GB
                </span>
              </div>
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="h-2 bg-secondary rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: "37%" }}
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    37% used
                  </span>
                  <button className="text-primary hover:underline">
                    Manage
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}



export default Dashboard;