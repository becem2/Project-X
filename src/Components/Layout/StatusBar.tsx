import { Activity, Cpu, Terminal } from "lucide-react";
import * as Progress from "@radix-ui/react-progress";

function StatusBar() {
  return (
    <div className="h-8 bg-[#0f1419] border-t border-border flex items-center justify-between px-4 text-xs">
      <div className="flex items-center gap-6">
        {/* Processing Status */}
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-primary" />
          <span className="text-muted-foreground">Ready</span>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center gap-2 min-w-[120px]">
          <Progress.Root className="relative h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <Progress.Indicator
              className="h-full w-0 bg-primary transition-all"
              style={{ transform: `translateX(0%)` }}
            />
          </Progress.Root>
          <span className="text-muted-foreground">0%</span>
        </div>

        {/* Logs */}
        <div className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
          <Terminal className="w-3.5 h-3.5" />
          <span>Logs</span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        {/* CPU/GPU Usage */}
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Cpu className="w-3.5 h-3.5" />
          <span>CPU: 12%</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Activity className="w-3.5 h-3.5" />
          <span>GPU: 8%</span>
        </div>
      </div>
    </div>
  );
}
export default StatusBar;
