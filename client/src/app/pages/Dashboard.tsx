import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { PageTransition } from '../components/ui/PageTransition';
import { Card } from '../components/ui/Card';
import { MessageSquare, Wrench, BrainCircuit, Bell, ArrowRight } from 'lucide-react';
import { useStore } from '../store';

const mockExpenses = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  amount: Math.floor(Math.random() * 500) + 50,
}));

const mockReminders = [
  { id: 1, title: 'Pay electricity bill', time: 'in 2 hours' },
  { id: 2, title: 'Call mom', time: 'tomorrow, 10 AM' },
  { id: 3, title: 'Cancel Netflix subscription', time: 'in 3 days' },
];

const mockActivity = [
  { id: 1, text: 'Logged ₹340 expense for Coffee', time: '10 mins ago' },
  { id: 2, text: 'Set reminder for 9am tomorrow', time: '2 hours ago' },
  { id: 3, text: 'Added new memory about coffee preference', time: 'Yesterday' },
  { id: 4, text: 'Summarized 3 unread emails', time: 'Yesterday' },
  { id: 5, text: 'Created calendar event for Team Sync', time: '2 days ago' },
];

export const Dashboard = () => {
  const user = useStore((state) => state.user);
  const [greeting, setGreeting] = useState('Good evening');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  return (
    <PageTransition className="space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-light tracking-wide">{greeting}, {user?.name || 'User'}</h1>
        <p className="text-muted-foreground mt-1">{format(new Date(), 'EEEE, MMMM do, yyyy')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 md:col-span-2 p-6 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-muted-foreground font-medium text-sm">{format(new Date(), 'MMMM')} Expenses</h3>
              <div className="text-3xl font-semibold mt-1">₹12,450</div>
            </div>
            <div className="flex gap-2">
              {['Food ₹4.2k', 'Transport ₹2.1k', 'Bills ₹3k'].map((cat) => (
                <div key={cat} className="px-3 py-1 bg-secondary rounded-full text-xs text-secondary-foreground">
                  {cat}
                </div>
              ))}
            </div>
          </div>
          <div className="h-24 w-full mt-auto">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockExpenses}>
                <Bar dataKey="amount" radius={[2, 2, 0, 0]}>
                  {mockExpenses.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === mockExpenses.length - 1 ? '#7c6aff' : '#2a2a2e'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <Bell className="w-5 h-5 text-primary" />
            <h3 className="font-medium">Upcoming Reminders</h3>
          </div>
          {mockReminders.length > 0 ? (
            <div className="space-y-4">
              {mockReminders.map((reminder) => (
                <div key={reminder.id} className="flex justify-between items-start">
                  <span className="text-sm font-medium">{reminder.title}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">{reminder.time}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <p className="text-sm text-muted-foreground">No reminders.</p>
              <p className="text-xs text-muted-foreground mt-1">Tell Nexus in Telegram to set one.</p>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-semibold">342</div>
            <div className="text-xs text-muted-foreground">Messages this month</div>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-semibold">4</div>
            <div className="text-xs text-muted-foreground">Tools connected</div>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-semibold">23</div>
            <div className="text-xs text-muted-foreground">Memory entries</div>
          </div>
        </Card>
      </div>

      <div>
        <h3 className="text-lg font-medium mb-4">Recent Activity</h3>
        <Card className="divide-y divide-border overflow-hidden">
          {mockActivity.map((activity) => (
            <div key={activity.id} className="p-4 flex items-center justify-between hover:bg-secondary/20 transition-colors">
              <span className="text-sm text-muted-foreground">{activity.text}</span>
              <span className="text-xs text-muted-foreground">{activity.time}</span>
            </div>
          ))}
        </Card>
      </div>
    </PageTransition>
  );
};
