import { useState } from "react";
import { useNavigate } from "react-router-dom";
import clientService from "../../services/clientService";
import { 
  BriefcaseIcon, 
  MapPinIcon, 
  CurrencyDollarIcon, 
  CalendarIcon, 
  ClipboardDocumentCheckIcon,
  SparklesIcon,
  PlusIcon,
  XMarkIcon,
  ChevronRightIcon
} from "@heroicons/react/24/outline";

export default function CreateRequirement() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");

  const [form, setForm] = useState({
    title: "",
    description: "",
    skills_mandatory: [],
    skills_good_to_have: [],
    experience_min: 0,
    experience_max: "",
    ctc_min: "",
    ctc_max: "",
    location_details: { city: "", type: "On-site" },
    certifications: [],
    positions_count: 1,
    interview_stages: ["Screening", "Technical", "HR"],
    urgency: "Normal",
    target_start_date: "",
    department: "",
    reporting_manager: "",
    priority: "Medium",
  });

  const [skillInput, setSkillInput] = useState({ mandatory: "", good: "" });

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.includes(".")) {
      const [parent, child] = name.split(".");
      setForm({
        ...form,
        [parent]: { ...form[parent], [child]: value }
      });
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const addSkill = (type) => {
    const value = type === "mandatory" ? skillInput.mandatory : skillInput.good;
    if (!value) return;
    
    const field = type === "mandatory" ? "skills_mandatory" : "skills_good_to_have";
    if (!form[field].includes(value)) {
      setForm({ ...form, [field]: [...form[field], value] });
    }
    setSkillInput({ ...skillInput, [type]: "" });
  };

  const removeSkill = (type, skill) => {
    const field = type === "mandatory" ? "skills_mandatory" : "skills_good_to_have";
    setForm({ ...form, [field]: form[field].filter(s => s !== skill) });
  };

  const autoParseJD = async () => {
    if (!form.description) {
      alert("Please paste a Job Description first!");
      return;
    }
    
    setLoading(true);
    try {
      const res = await clientService.parseJD(form.description);
      const data = res.data;
      
      setForm(prev => ({
        ...prev,
        skills_mandatory: [...new Set([...prev.skills_mandatory, ...(data.skills_mandatory || [])])],
        skills_good_to_have: [...new Set([...prev.skills_good_to_have, ...(data.skills_good_to_have || [])])],
        experience_min: data.experience_min || prev.experience_min,
        experience_max: data.experience_max || prev.experience_max,
        ctc_min: data.ctc_min || prev.ctc_min,
        ctc_max: data.ctc_max || prev.ctc_max,
        urgency: data.urgency || prev.urgency,
        location_details: {
          ...prev.location_details,
          city: data.location_details?.city || prev.location_details.city,
          type: data.location_details?.type || prev.location_details.type
        }
      }));
      
      alert("AI has successfully extracted requirements from the JD!");
      setActiveTab("skills"); // Move to skills tab to show results
    } catch (err) {
      console.error("AI Parsing Error:", err);
      alert("Failed to parse JD. But you can still fill it manually.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await clientService.createRequirement(form);
      alert("Requirement Created Successfully!");
      navigate("/client/requirements");
    } catch (err) {
      console.error("Submission Error:", err);
      alert(err.response?.data?.detail || "Failed to create requirement");
    } finally {
      setLoading(false);
    }
  };

  const SectionHeader = ({ icon: Icon, title, subtitle }) => (
    <div className="flex items-center space-x-3 mb-6 border-b pb-4">
      <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500">{subtitle}</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Post New Requirement</h1>
          <p className="text-gray-500 mt-1">Detailed intake for faster and better matching</p>
        </div>
        <button 
          onClick={() => navigate(-1)}
          className="text-gray-500 hover:text-gray-700 font-medium"
        >
          Cancel
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Navigation Sidebar */}
        <div className="md:col-span-1 space-y-2">
          {["basic", "description", "skills", "experience", "logistics", "process"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`w-full text-left px-4 py-3 rounded-xl font-medium transition-all ${
                activeTab === tab 
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" 
                : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
          
          <div className="mt-8 p-4 bg-amber-50 rounded-xl border border-amber-100">
            <div className="flex items-center space-x-2 text-amber-700 mb-2">
              <SparklesIcon className="w-5 h-5" />
              <span className="font-bold text-sm">AI Tip</span>
            </div>
            <p className="text-xs text-amber-600 leading-relaxed">
              Adding mandatory vs good-to-have skills helps our matching engine prioritize candidates better.
            </p>
          </div>
        </div>

        {/* Form Content */}
        <div className="md:col-span-3">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border p-8 space-y-8">
            
            {activeTab === "basic" && (
              <div className="animate-fadeIn">
                <SectionHeader 
                  icon={BriefcaseIcon} 
                  title="Basic Details" 
                  subtitle="Core information about the position" 
                />
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Job Title*</label>
                    <input
                      name="title"
                      required
                      value={form.title}
                      onChange={handleChange}
                      placeholder="e.g. Senior Fullstack Engineer"
                      className="w-full border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 transition-all border"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Department</label>
                    <input
                      name="department"
                      value={form.department}
                      onChange={handleChange}
                      placeholder="e.g. Engineering"
                      className="w-full border-gray-200 rounded-lg p-2.5 border"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Positions Count</label>
                    <input
                      type="number"
                      name="positions_count"
                      value={form.positions_count}
                      onChange={handleChange}
                      className="w-full border-gray-200 rounded-lg p-2.5 border"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Urgency</label>
                    <select
                      name="urgency"
                      value={form.urgency}
                      onChange={handleChange}
                      className="w-full border-gray-200 rounded-lg p-2.5 border"
                    >
                      <option>Immediate</option>
                      <option>Normal</option>
                      <option>Flexible</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Priority</label>
                    <select
                      name="priority"
                      value={form.priority}
                      onChange={handleChange}
                      className="w-full border-gray-200 rounded-lg p-2.5 border"
                    >
                      <option>High</option>
                      <option>Medium</option>
                      <option>Low</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "description" && (
              <div className="animate-fadeIn">
                <SectionHeader 
                  icon={ClipboardDocumentCheckIcon} 
                  title="Job Description" 
                  subtitle="Detailed role responsibilities" 
                />
                <div className="relative">
                  <textarea
                    name="description"
                    rows={12}
                    value={form.description}
                    onChange={handleChange}
                    placeholder="Paste the full job description here..."
                    className="w-full border-gray-200 rounded-xl p-4 focus:ring-2 focus:ring-indigo-500 transition-all border"
                  />
                  <button
                    type="button"
                    onClick={autoParseJD}
                    className="absolute bottom-4 right-4 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg font-bold text-sm flex items-center space-x-2 border border-indigo-100 hover:bg-indigo-100 transition-colors"
                  >
                    <SparklesIcon className="w-4 h-4" />
                    <span>AI Parse JD</span>
                  </button>
                </div>
              </div>
            )}

            {activeTab === "skills" && (
              <div className="animate-fadeIn">
                <SectionHeader 
                  icon={SparklesIcon} 
                  title="Skills & Qualifications" 
                  subtitle="What skills should the candidate have?" 
                />
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Mandatory Skills</label>
                    <div className="flex space-x-2 mb-3">
                      <input
                        value={skillInput.mandatory}
                        onChange={(e) => setSkillInput({...skillInput, mandatory: e.target.value})}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill("mandatory"))}
                        placeholder="Add skill and press Enter"
                        className="flex-1 border-gray-200 rounded-lg p-2 border text-sm"
                      />
                      <button 
                        type="button"
                        onClick={() => addSkill("mandatory")}
                        className="p-2 bg-indigo-600 text-white rounded-lg"
                      >
                        <PlusIcon className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {form.skills_mandatory.map(skill => (
                        <span key={skill} className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold flex items-center space-x-1 border border-indigo-100">
                          <span>{skill}</span>
                          <XMarkIcon 
                            className="w-3 h-3 cursor-pointer hover:text-indigo-900" 
                            onClick={() => removeSkill("mandatory", skill)}
                          />
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Good to Have Skills</label>
                    <div className="flex space-x-2 mb-3">
                      <input
                        value={skillInput.good}
                        onChange={(e) => setSkillInput({...skillInput, good: e.target.value})}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill("good"))}
                        placeholder="Add skill..."
                        className="flex-1 border-gray-200 rounded-lg p-2 border text-sm"
                      />
                      <button 
                        type="button"
                        onClick={() => addSkill("good")}
                        className="p-2 bg-emerald-600 text-white rounded-lg"
                      >
                        <PlusIcon className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {form.skills_good_to_have.map(skill => (
                        <span key={skill} className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold flex items-center space-x-1 border border-emerald-100">
                          <span>{skill}</span>
                          <XMarkIcon 
                            className="w-3 h-3 cursor-pointer hover:text-emerald-900" 
                            onClick={() => removeSkill("good", skill)}
                          />
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "experience" && (
              <div className="animate-fadeIn">
                <SectionHeader 
                  icon={CalendarIcon} 
                  title="Experience & Compensation" 
                  subtitle="Expectations and budget" 
                />
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Experience (Years)</h3>
                    <div className="flex items-center space-x-4">
                      <div className="flex-1">
                        <label className="text-xs text-gray-500 block mb-1">Min</label>
                        <input
                          type="number"
                          name="experience_min"
                          value={form.experience_min}
                          onChange={handleChange}
                          className="w-full border-gray-200 rounded-lg p-2 border"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-gray-500 block mb-1">Max</label>
                        <input
                          type="number"
                          name="experience_max"
                          value={form.experience_max}
                          onChange={handleChange}
                          className="w-full border-gray-200 rounded-lg p-2 border"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Salary / CTC Range</h3>
                    <div className="flex items-center space-x-4">
                      <div className="flex-1">
                        <label className="text-xs text-gray-500 block mb-1">Min</label>
                        <input
                          type="number"
                          name="ctc_min"
                          value={form.ctc_min}
                          onChange={handleChange}
                          className="w-full border-gray-200 rounded-lg p-2 border"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-gray-500 block mb-1">Max</label>
                        <input
                          type="number"
                          name="ctc_max"
                          value={form.ctc_max}
                          onChange={handleChange}
                          className="w-full border-gray-200 rounded-lg p-2 border"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "logistics" && (
              <div className="animate-fadeIn">
                <SectionHeader 
                  icon={MapPinIcon} 
                  title="Location & Logistics" 
                  subtitle="Where and how will they work?" 
                />
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">City / Base Location</label>
                    <input
                      name="location_details.city"
                      value={form.location_details.city}
                      onChange={handleChange}
                      placeholder="e.g. Hyderabad, India"
                      className="w-full border-gray-200 rounded-lg p-2.5 border"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Work Type</label>
                    <select
                      name="location_details.type"
                      value={form.location_details.type}
                      onChange={handleChange}
                      className="w-full border-gray-200 rounded-lg p-2.5 border"
                    >
                      <option>On-site</option>
                      <option>Remote</option>
                      <option>Hybrid</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Target Start Date</label>
                    <input
                      type="date"
                      name="target_start_date"
                      value={form.target_start_date}
                      onChange={handleChange}
                      className="w-full border-gray-200 rounded-lg p-2.5 border"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "process" && (
              <div className="animate-fadeIn">
                <SectionHeader 
                  icon={ClipboardDocumentCheckIcon} 
                  title="Process & Reporting" 
                  subtitle="Interview stages and management" 
                />
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Reporting Manager</label>
                    <input
                      name="reporting_manager"
                      value={form.reporting_manager}
                      onChange={handleChange}
                      placeholder="Name of hiring manager"
                      className="w-full border-gray-200 rounded-lg p-2.5 border"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Interview Stages</label>
                    <div className="flex flex-wrap gap-3">
                      {["Screening", "Technical Round 1", "Technical Round 2", "Management", "HR"].map(stage => (
                        <label key={stage} className="flex items-center space-x-2 bg-gray-50 px-3 py-2 rounded-lg border cursor-pointer hover:bg-white transition-colors">
                          <input 
                            type="checkbox"
                            checked={form.interview_stages.includes(stage)}
                            onChange={(e) => {
                              if (e.target.checked) setForm({...form, interview_stages: [...form.interview_stages, stage]});
                              else setForm({...form, interview_stages: form.interview_stages.filter(s => s !== stage)});
                            }}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-sm font-medium text-gray-700">{stage}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-6 border-t flex justify-between items-center">
              <div className="text-sm text-gray-500">
                {activeTab !== "process" && (
                  <button 
                    type="button"
                    onClick={() => {
                      const tabs = ["basic", "description", "skills", "experience", "logistics", "process"];
                      setActiveTab(tabs[tabs.indexOf(activeTab) + 1]);
                    }}
                    className="flex items-center space-x-1 text-indigo-600 font-bold hover:text-indigo-800"
                  >
                    <span>Next Section</span>
                    <ChevronRightIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={loading}
                className={`px-8 py-3 rounded-xl font-bold text-white shadow-xl transition-all ${
                  loading 
                  ? "bg-gray-400 cursor-not-allowed" 
                  : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 hover:-translate-y-0.5"
                }`}
              >
                {loading ? "Creating..." : "Confirm & Post Requirement"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
