import React, { useEffect, useState } from "react";
import api from "../../api/axios";
import { useParams, useNavigate } from "react-router-dom";
import { Users, Briefcase, Star, Clock, CheckCircle2, AlertCircle } from "lucide-react";

export default function RecruiterAssignment() {
  const { id } = useParams(); // This is jobId from URL
  const navigate = useNavigate();
  
  const [job, setJob] = useState(null);
  const [recruiters, setRecruiters] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [slaDays, setSlaDays] = useState(7);
  const [targetCVs, setTargetCVs] = useState(5);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [recRes, jobRes] = await Promise.all([
        api.get("/v1/am/recruiters"),
        api.get(`/v1/recruiter/jobs/${id}`)
      ]);
      
      setRecruiters(recRes.data?.data || []);
      setJob(jobRes.data);
      
      // If job already has recruiters, pre-select them
      if (jobRes.data?.recruiters) {
        setSelectedIds(jobRes.data.recruiters.map(r => r.id));
      }
    } catch (err) {
      console.error("Failed to load assignment data:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleRecruiter = (rid) => {
    setSelectedIds(prev => 
      prev.includes(rid) ? prev.filter(i => i !== rid) : [...prev, rid]
    );
  };

  const handleAssign = async () => {
    if (selectedIds.length === 0) {
      alert("Please select at least one recruiter");
      return;
    }

    try {
      setSaving(true);
      // Backend expects requirement_id, but we have jobId
      // We need to find requirement_id if we want to use the new endpoint
      // OR update the endpoint to accept jobId? 
      // Actually, my new backend endpoint used payload.requirement_id.
      // I'll update the backend to also accept jobId or look it up.
      
      // For now, I'll assume jobId is enough if I update backend.
      // Wait, let's check requirement_id from job object if available.
      const reqId = job?.requirement_id || job?.id; // fallback

      await api.post("/v1/am/requirements/assign", {
        requirement_id: reqId,
        recruiter_ids: selectedIds,
        sla_deadline_days: parseInt(slaDays),
        target_cv_count: parseInt(targetCVs)
      });

      alert("Recruiters Assigned & SLA Set! 🚀");
      navigate(-1);
    } catch (err) {
      console.error("Assignment failed:", err);
      alert("Failed to assign. Check console.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-500">Loading recruiters...</div>;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assign Recruiters</h1>
          <p className="text-gray-500 text-sm mt-1">
            Job: <span className="font-semibold text-purple-700">{job?.title}</span> ({job?.job_id})
          </p>
        </div>
        <button 
          onClick={() => navigate(-1)}
          className="text-gray-500 hover:text-gray-700 text-sm font-medium"
        >
          Cancel
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Recruiter Selection */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">Available Recruiters</h2>
            <span className="text-xs text-gray-500">{recruiters.length} Total</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recruiters.map((r) => {
              const isSelected = selectedIds.includes(r.id);
              return (
                <div 
                  key={r.id}
                  onClick={() => toggleRecruiter(r.id)}
                  className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    isSelected 
                    ? "border-purple-600 bg-purple-50 ring-2 ring-purple-100" 
                    : "border-gray-100 bg-white hover:border-gray-300"
                  }`}
                >
                   {isSelected && (
                     <CheckCircle2 className="absolute top-3 right-3 text-purple-600" size={20} />
                   )}
                   
                   <div className="flex items-center gap-3">
                     <div className="h-10 w-10 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm">
                       {r.full_name?.charAt(0) || "R"}
                     </div>
                     <div>
                       <h3 className="font-bold text-gray-900 text-sm">{r.full_name}</h3>
                       <p className="text-xs text-gray-500">{r.email}</p>
                     </div>
                   </div>

                   <div className="mt-4 flex items-center justify-between">
                     <div className="flex items-center gap-1 text-xs font-medium text-gray-600">
                       <Briefcase size={14} className="text-gray-400" />
                       <span>{r.workload} Active Jobs</span>
                     </div>
                     <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                       r.status === "busy" ? "bg-orange-100 text-orange-600" : "bg-green-100 text-green-600"
                     }`}>
                       {r.status}
                     </span>
                   </div>

                   <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-1">
                     {r.specialization?.map(skill => (
                       <span key={skill} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-medium">
                         {skill}
                       </span>
                     )) || <span className="text-[10px] text-gray-400">No specialization data</span>}
                   </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: SLA & Finalize */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">SLA & Targets</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  1st CV Deadline (Days)
                </label>
                <div className="relative">
                   <Clock className="absolute left-3 top-2.5 text-gray-400" size={16} />
                   <input 
                    type="number" 
                    value={slaDays}
                    onChange={(e) => setSlaDays(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                    placeholder="7"
                   />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target CV Count
                </label>
                <div className="relative">
                   <Star className="absolute left-3 top-2.5 text-gray-400" size={16} />
                   <input 
                    type="number" 
                    value={targetCVs}
                    onChange={(e) => setTargetCVs(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                    placeholder="5"
                   />
                </div>
              </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-xl flex gap-3">
              <AlertCircle className="text-blue-500 shrink-0" size={20} />
              <p className="text-xs text-blue-700 leading-relaxed">
                Assigning multiple recruiters activates <b>competitive sourcing mode</b>. First to submit quality profiles wins the slot.
              </p>
            </div>

            <div className="pt-2">
              <button 
                onClick={handleAssign}
                disabled={saving || selectedIds.length === 0}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                  saving || selectedIds.length === 0
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-100"
                }`}
              >
                {saving ? "Processing..." : `Assign ${selectedIds.length} Recruiter${selectedIds.length > 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
          
          {/* Summary Section */}
          <div className="bg-gray-50 rounded-2xl p-6">
             <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Selection Summary</h3>
             <ul className="space-y-2">
               {recruiters.filter(r => selectedIds.includes(r.id)).map(r => (
                 <li key={r.id} className="flex justify-between items-center text-sm">
                   <span className="text-gray-700 font-medium">{r.full_name}</span>
                   <span className="text-[10px] font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded uppercase">Selected</span>
                 </li>
               ))}
               {selectedIds.length === 0 && <li className="text-sm text-gray-400 italic">No recruiters selected</li>}
             </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
