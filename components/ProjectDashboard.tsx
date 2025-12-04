
import React, { useState } from 'react';
import { ActiveProject, ProjectTask, User } from '../types';
import { ClipboardDocumentCheckIcon, ClockIcon, PhotoIcon, TrashIcon, CheckBadgeIcon, ArrowLeftIcon } from './Icons';
import * as db from '../services/db';

interface ProjectDashboardProps {
    currentUser: User;
    onBack: () => void;
}

const ProjectDashboard: React.FC<ProjectDashboardProps> = ({ currentUser, onBack }) => {
    const [projects, setProjects] = useState<ActiveProject[]>(db.getProjects(currentUser.id));
    const [activeProjectId, setActiveProjectId] = useState<string | null>(projects.length > 0 ? projects[0].id : null);

    const activeProject = projects.find(p => p.id === activeProjectId);

    const handleTaskToggle = (taskId: string) => {
        if (!activeProject) return;
        
        const updatedTasks: ProjectTask[] = activeProject.tasks.map(t => 
            t.id === taskId 
                ? { ...t, status: t.status === 'completed' ? 'pending' : 'completed' } 
                : t
        );
        
        const updatedProject = { ...activeProject, tasks: updatedTasks };
        db.updateProject(updatedProject);
        setProjects(db.getProjects(currentUser.id));
    };

    const handleDeleteProject = (projectId: string) => {
        // In a real app we'd delete from DB, for now we just filter local state to simulate
        // or actually implement delete in db.ts if needed.
        // For simplicity let's assume we implement a delete or just hide it
        alert("Delete functionality would go here.");
    };

    return (
        <div className="bg-white rounded-2xl shadow-xl min-h-[80vh] flex flex-col md:flex-row overflow-hidden border border-slate-200">
            {/* Sidebar */}
            <div className="w-full md:w-64 bg-slate-50 border-r border-slate-200 flex flex-col">
                <div className="p-4 border-b border-slate-200">
                    <button onClick={onBack} className="flex items-center text-sm font-semibold text-slate-500 hover:text-indigo-600 mb-4">
                        <ArrowLeftIcon className="w-4 h-4 mr-1" /> Back
                    </button>
                    <h2 className="text-xl font-bold text-slate-800">My Projects</h2>
                </div>
                <div className="flex-grow overflow-y-auto p-2 space-y-2">
                    {projects.length === 0 ? (
                        <div className="text-center py-8 px-4 text-slate-400 text-sm">
                            No active projects. Start a search and save it as a project!
                        </div>
                    ) : (
                        projects.map(project => (
                            <button
                                key={project.id}
                                onClick={() => setActiveProjectId(project.id)}
                                className={`w-full text-left p-3 rounded-lg text-sm font-medium transition-colors ${
                                    activeProjectId === project.id 
                                        ? 'bg-white shadow-sm border border-indigo-200 text-indigo-700' 
                                        : 'hover:bg-slate-100 text-slate-600'
                                }`}
                            >
                                <div className="truncate font-bold">{project.title}</div>
                                <div className="text-xs opacity-70 flex justify-between mt-1">
                                    <span>{project.status}</span>
                                    <span>{(project.tasks.filter(t => t.status === 'completed').length / project.tasks.length * 100).toFixed(0)}%</span>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 bg-white p-6 md:p-8 overflow-y-auto">
                {activeProject ? (
                    <div className="max-w-4xl mx-auto">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h1 className="text-3xl font-extrabold text-slate-800">{activeProject.title}</h1>
                                <p className="text-slate-500 mt-1">{activeProject.category} • Started {activeProject.startDate}</p>
                            </div>
                            <div className="bg-indigo-50 px-3 py-1 rounded-full text-xs font-bold text-indigo-700 uppercase tracking-wide border border-indigo-100">
                                {activeProject.status}
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mb-8">
                            <div className="flex justify-between text-sm font-medium text-slate-600 mb-2">
                                <span>Progress</span>
                                <span>{activeProject.tasks.filter(t => t.status === 'completed').length} / {activeProject.tasks.length} Tasks</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                <div 
                                    className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500" 
                                    style={{ width: `${(activeProject.tasks.filter(t => t.status === 'completed').length / activeProject.tasks.length) * 100}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Task List */}
                            <div className="lg:col-span-2 space-y-6">
                                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center">
                                        <ClipboardDocumentCheckIcon className="w-5 h-5 text-slate-500 mr-2" />
                                        <h3 className="font-bold text-slate-700">Project Timeline & Tasks</h3>
                                    </div>
                                    <div className="divide-y divide-slate-100">
                                        {activeProject.tasks.map(task => (
                                            <div key={task.id} className="p-4 flex items-start hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => handleTaskToggle(task.id)}>
                                                <div className={`flex-shrink-0 w-5 h-5 rounded border mt-0.5 mr-3 flex items-center justify-center transition-colors ${task.status === 'completed' ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'}`}>
                                                    {task.status === 'completed' && <CheckBadgeIcon className="w-3.5 h-3.5 text-white" />}
                                                </div>
                                                <div className={task.status === 'completed' ? 'opacity-50 line-through' : ''}>
                                                    <p className="text-sm font-medium text-slate-800">{task.title}</p>
                                                    {task.dueDate && <p className="text-xs text-slate-400 mt-0.5 flex items-center"><ClockIcon className="w-3 h-3 mr-1"/> Due: {task.dueDate}</p>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Documents/Photos Placeholder */}
                                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 text-center border-dashed">
                                    <PhotoIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                                    <h3 className="text-sm font-bold text-slate-700">Project Files</h3>
                                    <p className="text-xs text-slate-500 mt-1">Upload photos, permits, and invoices here.</p>
                                    <button className="mt-3 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors">
                                        + Upload File
                                    </button>
                                </div>
                            </div>

                            {/* Sidebar Info */}
                            <div className="space-y-6">
                                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                                    <h3 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wide">Project Details</h3>
                                    <div className="space-y-3 text-sm">
                                        <div>
                                            <span className="block text-slate-500 text-xs">Estimated Budget</span>
                                            <span className="font-mono font-medium text-slate-700">${activeProject.budget.toLocaleString()}</span>
                                        </div>
                                        <div>
                                            <span className="block text-slate-500 text-xs">Start Date</span>
                                            <span className="font-medium text-slate-700">{activeProject.startDate}</span>
                                        </div>
                                         <div>
                                            <span className="block text-slate-500 text-xs">Notes</span>
                                            <p className="text-slate-600 mt-1 leading-relaxed text-xs">{activeProject.notes}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                        <ClipboardDocumentCheckIcon className="w-16 h-16 mb-4 opacity-50" />
                        <p>Select a project to view details</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProjectDashboard;
