# Long-running input helper (Windows PowerShell 5.1). Reads commands from stdin, one per line:
#   move X Y MS | click | key {ENTER} | type TEXT | winmove TITLE X Y W H | winclose TITLE | focus TITLE
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System; using System.Runtime.InteropServices; using System.Text;
public class W {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f,uint dx,uint dy,uint d,UIntPtr e);
  public struct POINT{public int X;public int Y;}
  public delegate bool EnumProc(IntPtr h,IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc p,IntPtr l);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h,StringBuilder s,int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h,int x,int y,int w,int ht,bool r);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h,uint m,IntPtr w,IntPtr l);
  public static IntPtr Find(string t){ IntPtr r=IntPtr.Zero; EnumWindows((h,l)=>{ if(!IsWindowVisible(h))return true; var s=new StringBuilder(256); GetWindowText(h,s,256); if(s.ToString()==t){r=h;return false;} return true;},IntPtr.Zero); return r; }
}
"@
[Console]::Out.WriteLine("ready")
while (($line = [Console]::In.ReadLine()) -ne $null) {
  $p = $line.Split(' ', 2); $cmd = $p[0]; $arg = if ($p.Length -gt 1) { $p[1] } else { '' }
  switch ($cmd) {
    'move' { $a = $arg.Split(' '); $tx=[int]$a[0]; $ty=[int]$a[1]; $ms=[int]$a[2]
      $c = New-Object W+POINT; [void][W]::GetCursorPos([ref]$c); $steps=[Math]::Max(1,[int]($ms/16))
      for($i=1;$i -le $steps;$i++){ $t=$i/$steps; $e=$t*$t*(3-2*$t)
        [void][W]::SetCursorPos([int]($c.X+($tx-$c.X)*$e),[int]($c.Y+($ty-$c.Y)*$e)); Start-Sleep -Milliseconds 16 } }
    'click' { [W]::mouse_event(2,0,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 70; [W]::mouse_event(4,0,0,0,[UIntPtr]::Zero) }
    'key' { [System.Windows.Forms.SendKeys]::SendWait($arg) }
    'type' { foreach($ch in $arg.ToCharArray()){ [System.Windows.Forms.SendKeys]::SendWait($ch.ToString()); Start-Sleep -Milliseconds 70 } }
    'winmove' { $a=$arg.Split('|'); $h=[W]::Find($a[0]); if($h -ne [IntPtr]::Zero){ [void][W]::MoveWindow($h,[int]$a[1],[int]$a[2],[int]$a[3],[int]$a[4],$true); [void][W]::SetForegroundWindow($h); [Console]::Out.WriteLine("moved") } else { [Console]::Out.WriteLine("notfound") } }
    'winclose' { $h=[W]::Find($arg); if($h -ne [IntPtr]::Zero){ [void][W]::PostMessage($h,0x10,[IntPtr]::Zero,[IntPtr]::Zero) } }
    'focus' { $h=[W]::Find($arg); if($h -ne [IntPtr]::Zero){ [void][W]::SetForegroundWindow($h) } }
  }
  [Console]::Out.WriteLine("ok")
}
