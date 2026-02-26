import React, { useState, useEffect, useRef } from 'react'
import axios from '../api/axios'

function Settings() {
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('organization')
  const [saveMessage, setSaveMessage] = useState('')
  const [exportingJobs, setExportingJobs] = useState(false)
  const [exportError, setExportError] = useState('')
  const [exportPassword, setExportPassword] = useState('')
  const [passwordPromptOpen, setPasswordPromptOpen] = useState(false)
  const [uploadingBulk, setUploadingBulk] = useState(false)
  const [uploadMessage, setUploadMessage] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [bulkFile, setBulkFile] = useState(null)
  const fileInputRef = useRef(null)
  const [twoFactorConfig, setTwoFactorConfig] = useState({})
  const [updating2faRole, setUpdating2faRole] = useState('')
  const [twoFactorError, setTwoFactorError] = useState('')

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await axios.get('/v1/settings')
      setSettings(response.data)
      const rawConfig =
        response.data?.access?.two_factor?.value ||
        response.data?.security?.two_factor?.value ||
        {}
      setTwoFactorConfig(rawConfig)
      setLoading(false)
    } catch (error) {
      console.error('Error loading settings:', error)
      setLoading(false)
    }
  }

  const updateSetting = async (module, key, value) => {
    try {
      await axios.put('/v1/settings', {
        module_name: module,
        setting_key: key,
        setting_value: value
      })
      setSaveMessage('Settings saved successfully!')
      setTimeout(() => setSaveMessage(''), 3000)
      loadSettings()
    } catch (error) {
      console.error('Error saving settings:', error)
      setSaveMessage('Error saving settings')
    }
  }

  const tabs = [
    { id: 'organization', label: 'Organization Profile', icon: '🏢' },
    { id: 'access', label: 'Access & Roles', icon: '🔐' },
    { id: 'recruitment', label: 'Recruitment Automation', icon: '🎯' },
    { id: 'employee', label: 'Employee Management', icon: '👥' },
    { id: 'payroll', label: 'Payroll & Finance', icon: '💰' },
    { id: 'communications', label: 'Communications', icon: '📧' },
    { id: 'ai', label: 'AI & Data Governance', icon: '🤖' },
    { id: 'integrations', label: 'Integrations & Audit', icon: '🔌' },
    { id: 'data', label: 'Data Operations', icon: '📊' }
  ]

  const renderOrganizationTab = () => {
    const orgSettings = settings.organization || {}
    const profile = orgSettings.profile?.value || {}
    
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Company Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Company Name</label>
              <input
                type="text"
                placeholder="ATS HR Solutions"
                value={profile.company_name || ''}
                onChange={(e) => updateSetting('organization', 'profile', {
                  ...profile,
                  company_name: e.target.value
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Industry</label>
              <select
                value={profile.industry || ''}
                onChange={(e) => updateSetting('organization', 'profile', {
                  ...profile,
                  industry: e.target.value
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select Industry</option>
                <option value="technology">Technology</option>
                <option value="finance">Finance</option>
                <option value="healthcare">Healthcare</option>
                <option value="manufacturing">Manufacturing</option>
                <option value="retail">Retail</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Company Size</label>
              <select
                value={profile.company_size || ''}
                onChange={(e) => updateSetting('organization', 'profile', {
                  ...profile,
                  company_size: e.target.value
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select Size</option>
                <option value="1-10">1-10 employees</option>
                <option value="11-50">11-50 employees</option>
                <option value="51-200">51-200 employees</option>
                <option value="201-500">201-500 employees</option>
                <option value="500+">500+ employees</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Timezone</label>
              <select
                value={profile.timezone || ''}
                onChange={(e) => updateSetting('organization', 'profile', {
                  ...profile,
                  timezone: e.target.value
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select Timezone</option>
                <option value="UTC">UTC</option>
                <option value="EST">EST (Eastern)</option>
                <option value="PST">PST (Pacific)</option>
                <option value="IST">IST (India)</option>
                <option value="GMT">GMT (London)</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2">Address</label>
              <textarea
                placeholder="Company address"
                value={profile.address || ''}
                onChange={(e) => updateSetting('organization', 'profile', {
                  ...profile,
                  address: e.target.value
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={2}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderAccessTab = () => {
    const accessSettings = settings.access || {}
    const security = accessSettings.security?.value || {}
    const roleKeys =
      settings?.access?.roles?.value ||
      twoFactorConfig?.roles ||
      {
        admin: 'Admin',
        recruiter: 'Recruiter',
        account_manager: 'Account Manager',
        internal_hr: 'Internal HR',
        consultant: 'Consultant',
        employee: 'Employee',
        accounts: 'Accounts',
        consultant_support: 'Consultant Support',
        candidate: 'Candidate'
      }
    
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Security Settings</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Two-Factor Authentication</p>
                <p className="text-sm text-gray-600">Require 2FA for all admin users</p>
              </div>
              <input
                type="checkbox"
                checked={security.require_2fa || false}
                onChange={(e) => updateSetting('access', 'security', {
                  ...security,
                  require_2fa: e.target.checked
                })}
                className="w-5 h-5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Session Timeout (minutes)</label>
              <input
                type="number"
                min="15"
                max="480"
                value={security.session_timeout || 60}
                onChange={(e) => updateSetting('access', 'security', {
                  ...security,
                  session_timeout: parseInt(e.target.value)
                })}
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Minimum Password Length</label>
              <input
                type="number"
                min="6"
                max="20"
                value={security.min_password_length || 8}
                onChange={(e) => updateSetting('access', 'security', {
                  ...security,
                  min_password_length: parseInt(e.target.value)
                })}
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Role Permissions Matrix</h3>
          <p className="text-sm text-gray-600 mb-4">Current role-based access control is predefined. Contact support for custom role creation.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Module</th>
                  <th className="px-4 py-2 text-center">Admin</th>
                  <th className="px-4 py-2 text-center">Recruiter</th>
                  <th className="px-4 py-2 text-center">Employee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="px-4 py-2">Talent Acquisition</td>
                  <td className="px-4 py-2 text-center">✅ Full Access</td>
                  <td className="px-4 py-2 text-center">✅ Full Access</td>
                  <td className="px-4 py-2 text-center">❌ No Access</td>
                </tr>
                <tr>
                  <td className="px-4 py-2">Employee Management</td>
                  <td className="px-4 py-2 text-center">✅ Full Access</td>
                  <td className="px-4 py-2 text-center">👁️ View Only</td>
                  <td className="px-4 py-2 text-center">👁️ Self Only</td>
                </tr>
                <tr>
                  <td className="px-4 py-2">Finance & Payroll</td>
                  <td className="px-4 py-2 text-center">✅ Full Access</td>
                  <td className="px-4 py-2 text-center">❌ No Access</td>
                  <td className="px-4 py-2 text-center">❌ No Access</td>
                </tr>
                <tr>
                  <td className="px-4 py-2">User Management</td>
                  <td className="px-4 py-2 text-center">✅ Full Access</td>
                  <td className="px-4 py-2 text-center">❌ No Access</td>
                  <td className="px-4 py-2 text-center">❌ No Access</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">Two-Factor Authentication</h3>
              <p className="text-sm text-gray-500">
                Require 2FA for sensitive roles. Users in enabled roles must
                configure an authenticator app on next login.
              </p>
            </div>
            {twoFactorError && (
              <span className="text-sm text-red-600">{twoFactorError}</span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">
                    Role
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">
                    Description
                  </th>
                  <th className="px-4 py-2 text-center font-medium text-gray-500">
                    Require 2FA
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {Object.keys(roleKeys).map((role) => {
                  const enabled = !!twoFactorConfig[role]
                  const label =
                    roleKeys[role]?.name ||
                    roleKeys[role] ||
                    role.replace(/_/g, ' ')

                  return (
                    <tr key={role} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-900 capitalize">
                        {label}
                      </td>
                      <td className="px-4 py-2 text-gray-500">
                        {role === 'admin'
                          ? 'Full platform access'
                          : role === 'recruiter'
                          ? 'Manages talent pipeline'
                          : role === 'accounts'
                          ? 'Finance & payroll operations'
                          : 'Application user'}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={enabled}
                            disabled={updating2faRole === role}
                            onChange={(e) => handleRoleTwoFactor(role, e.target.checked)}
                          />
                          {updating2faRole === role && (
                            <span className="text-xs text-gray-500">Saving…</span>
                          )}
                        </label>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  const renderRecruitmentTab = () => {
    const recruitmentSettings = settings.recruitment || {}
    
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Auto Screening</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Enable Auto Screening</p>
                <p className="text-sm text-gray-600">Automatically screen candidates using AI</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={recruitmentSettings.auto_screening_enabled?.value?.enabled || false}
                  onChange={(e) => updateSetting('recruitment', 'auto_screening_enabled', {
                    enabled: e.target.checked,
                    threshold: recruitmentSettings.auto_screening_enabled?.value?.threshold || 70
                  })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Screening Threshold (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={recruitmentSettings.auto_screening_enabled?.value?.threshold || 70}
                onChange={(e) => updateSetting('recruitment', 'auto_screening_enabled', {
                  enabled: recruitmentSettings.auto_screening_enabled?.value?.enabled || true,
                  threshold: parseInt(e.target.value)
                })}
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Interview Configuration</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Text Interviews</p>
                <p className="text-sm text-gray-600">Enable text-based AI interviews</p>
              </div>
              <input
                type="checkbox"
                checked={recruitmentSettings.interview_modes?.value?.text || false}
                onChange={(e) => updateSetting('recruitment', 'interview_modes', {
                  ...recruitmentSettings.interview_modes?.value,
                  text: e.target.checked
                })}
                className="w-5 h-5"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Video Interviews</p>
                <p className="text-sm text-gray-600">Enable video-based AI interviews</p>
              </div>
              <input
                type="checkbox"
                checked={recruitmentSettings.interview_modes?.value?.video || false}
                onChange={(e) => updateSetting('recruitment', 'interview_modes', {
                  ...recruitmentSettings.interview_modes?.value,
                  video: e.target.checked
                })}
                className="w-5 h-5"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Lead Scoring Rules</h3>
          <p className="text-sm text-gray-600 mb-4">Configure automatic lead qualification scoring</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">LinkedIn profile present</span>
              <span className="text-sm font-semibold text-blue-600">+20 points</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Email engagement (opens/clicks)</span>
              <span className="text-sm font-semibold text-blue-600">+30 points</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Referred by employee</span>
              <span className="text-sm font-semibold text-blue-600">+40 points</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const handleRoleTwoFactor = async (role, enabled) => {
    setTwoFactorError('')
    setUpdating2faRole(role)
    try {
      await axios.put('/v1/settings/2fa', { role, enabled })
      setTwoFactorConfig((prev) => ({ ...prev, [role]: enabled }))
    } catch (error) {
      console.error('Failed to update two-factor setting', error)
      setTwoFactorError(
        error?.response?.data?.detail ||
          'Unable to update the two-factor requirement right now.'
      )
    } finally {
      setUpdating2faRole('')
    }
  }

  const renderEmployeeTab = () => {
    const leaveSettings = settings.leaves || {}
    const policy = leaveSettings.leave_policy?.value || {}
    const workflow = leaveSettings.approval_workflow?.value || {}

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Leave Allocation (Days per Year)</h3>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(policy).filter(([key]) => key !== 'auto_approve_threshold').map(([type, days]) => (
              <div key={type}>
                <label className="block text-sm font-medium mb-2 capitalize">{type.replace('_', ' ')}</label>
                <input
                  type="number"
                  value={days}
                  onChange={(e) => updateSetting('leaves', 'leave_policy', {
                    ...policy,
                    [type]: parseInt(e.target.value)
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Approval Workflow</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Require Manager Approval</p>
                <p className="text-sm text-gray-600">All leave requests need manager approval</p>
              </div>
              <input
                type="checkbox"
                checked={workflow.requires_manager_approval || false}
                onChange={(e) => updateSetting('leaves', 'approval_workflow', {
                  ...workflow,
                  requires_manager_approval: e.target.checked
                })}
                className="w-5 h-5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Auto-approve leaves up to (days)</label>
              <input
                type="number"
                value={workflow.auto_approve_days || 2}
                onChange={(e) => updateSetting('leaves', 'approval_workflow', {
                  ...workflow,
                  auto_approve_days: parseInt(e.target.value)
                })}
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Performance Management</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Review Cycle Frequency</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="quarterly">Quarterly</option>
                <option value="semi-annual">Semi-Annual</option>
                <option value="annual">Annual</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Enable Self-Assessment</p>
                <p className="text-sm text-gray-600">Allow employees to self-evaluate</p>
              </div>
              <input type="checkbox" defaultChecked className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Probation Settings</h3>
          <div>
            <label className="block text-sm font-medium mb-2">Default Probation Period (days)</label>
            <input
              type="number"
              defaultValue={90}
              className="w-32 px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>
      </div>
    )
  }

  const renderPayrollTab = () => {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Payroll Configuration</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Pay Frequency</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="monthly">Monthly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Currency</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="INR">INR (₹)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Fiscal Year Start</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="january">January</option>
                <option value="april">April</option>
                <option value="july">July</option>
                <option value="october">October</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Tax Calculation Method</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="automatic">Automatic</option>
                <option value="manual">Manual</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Standard Deduction Types</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between py-2 border-b">
              <span>Income Tax</span>
              <span className="text-blue-600">Percentage-based</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span>Provident Fund (PF)</span>
              <span className="text-blue-600">Percentage-based</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span>Health Insurance</span>
              <span className="text-blue-600">Fixed Amount</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span>Loans & Advances</span>
              <span className="text-blue-600">One-time</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Invoice Settings</h3>
          <div>
            <label className="block text-sm font-medium mb-2">Invoice Number Format</label>
            <input
              type="text"
              placeholder="INV-{YYYY}-{MM}-{###}"
              defaultValue="INV-{YYYY}-{MM}-{###}"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">Placeholders: {"{YYYY}"} year, {"{MM}"} month, {"{###}"} auto-increment</p>
          </div>
        </div>
      </div>
    )
  }

  const renderCommunicationsTab = () => {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Email Configuration (SMTP)</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2">SMTP Host</label>
              <input
                type="text"
                placeholder="smtp.gmail.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">SMTP Port</label>
              <input
                type="number"
                placeholder="587"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Encryption</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="tls">TLS</option>
                <option value="ssl">SSL</option>
                <option value="none">None</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Username</label>
              <input
                type="text"
                placeholder="your@email.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">SMS Provider (Twilio)</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Account SID</label>
              <input
                type="text"
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Auth Token</label>
              <input
                type="password"
                placeholder="••••••••••••••••••••••••••••••••"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">From Phone Number</label>
              <input
                type="tel"
                placeholder="+1234567890"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">WhatsApp Business API</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Phone Number ID</label>
              <input
                type="text"
                placeholder="123456789012345"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Business Account ID</label>
              <input
                type="text"
                placeholder="123456789012345"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Slack Integration</h3>
          <div>
            <label className="block text-sm font-medium mb-2">Webhook URL</label>
            <input
              type="url"
              placeholder="https://hooks.slack.com/services/..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
            />
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Notification Preferences</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Candidate stage change notifications</span>
              <input type="checkbox" defaultChecked className="w-5 h-5" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Leave request notifications</span>
              <input type="checkbox" defaultChecked className="w-5 h-5" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Performance review reminders</span>
              <input type="checkbox" defaultChecked className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderAITab = () => {
    const aiSettings = settings.ai || {}
    const models = aiSettings.models?.value || {}

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">AI Models Configuration</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Resume Parser Model</label>
              <select
                value={models.resume_parser || 'local-nlp-v1'}
                onChange={(e) => updateSetting('ai', 'models', {
                  ...models,
                  resume_parser: e.target.value
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="local-nlp-v1">Local NLP v1 (No API costs)</option>
                <option value="local-nlp-v2">Local NLP v2 (Improved accuracy)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Interview Bot Model</label>
              <select
                value={models.interview_bot || 'local-llm-v1'}
                onChange={(e) => updateSetting('ai', 'models', {
                  ...models,
                  interview_bot: e.target.value
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="local-llm-v1">Local LLM v1 (Fast, basic)</option>
                <option value="local-llm-v2">Local LLM v2 (Slower, better)</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Bias Detection</p>
                <p className="text-sm text-gray-600">Monitor AI decisions for bias</p>
              </div>
              <input
                type="checkbox"
                checked={models.bias_detection === 'enabled'}
                onChange={(e) => updateSetting('ai', 'models', {
                  ...models,
                  bias_detection: e.target.checked ? 'enabled' : 'disabled'
                })}
                className="w-5 h-5"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Data Governance & Privacy</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Data Retention Period (days)</label>
              <input
                type="number"
                defaultValue={365}
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg"
              />
              <p className="text-xs text-gray-500 mt-1">How long to keep candidate/employee data after departure</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Anonymize PII in Reports</p>
                <p className="text-sm text-gray-600">Remove personally identifiable information from analytics</p>
              </div>
              <input type="checkbox" defaultChecked className="w-5 h-5" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Explainable AI</p>
                <p className="text-sm text-gray-600">Provide explanations for all AI decisions</p>
              </div>
              <input type="checkbox" defaultChecked className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Resume Data Extraction</h3>
          <p className="text-sm text-gray-600 mb-4">Configure which data fields to extract from resumes</p>
          <div className="grid grid-cols-2 gap-3">
            {['Skills', 'Experience', 'Education', 'Certifications', 'Projects', 'Languages'].map(field => (
              <div key={field} className="flex items-center space-x-2">
                <input type="checkbox" defaultChecked className="w-4 h-4" />
                <span className="text-sm">{field}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const renderIntegrationsTab = () => {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Third-Party Integrations</h3>
          <p className="text-sm text-gray-600 mb-4">Connect external services to Akshu HR</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-xl">📧</span>
                </div>
                <div>
                  <p className="font-medium">SMTP Email</p>
                  <p className="text-xs text-gray-500">Configure in Communications tab</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">Pending</span>
            </div>
            <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <span className="text-xl">💬</span>
                </div>
                <div>
                  <p className="font-medium">Slack</p>
                  <p className="text-xs text-gray-500">Team notifications</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">Pending</span>
            </div>
            <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <span className="text-xl">📱</span>
                </div>
                <div>
                  <p className="font-medium">Twilio SMS</p>
                  <p className="text-xs text-gray-500">SMS notifications</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">Pending</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">API Keys & Webhooks</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">API Key (for external integrations)</label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value="ak_live_xxxxxxxxxxxxxxxxxxxxxxxx"
                  readOnly
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm"
                />
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                  Regenerate
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Webhook Endpoint</label>
              <input
                type="url"
                placeholder="https://your-domain.com/webhooks/akshu-hr"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">Receive real-time event notifications</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">System Audit Logs</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between py-2 border-b text-sm">
              <span className="text-gray-600">Total events logged</span>
              <span className="font-semibold">1,247</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b text-sm">
              <span className="text-gray-600">User actions tracked</span>
              <span className="font-semibold">892</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b text-sm">
              <span className="text-gray-600">System events</span>
              <span className="font-semibold">355</span>
            </div>
          </div>
          <button className="mt-4 w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium">
            Export Audit Logs
          </button>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Data Backup & Export</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Automatic Backups</p>
                <p className="text-xs text-gray-600">Daily backup at 2:00 AM UTC</p>
              </div>
              <input type="checkbox" defaultChecked className="w-5 h-5" />
            </div>
            <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
              Create Manual Backup Now
            </button>
            <button className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium">
              Export All Data (CSV)
            </button>
          </div>
        </div>
      </div>
    )
  }

  const handleExportJobs = async () => {
    setExportError('')
    if (!exportPassword.trim()) {
      setPasswordPromptOpen(true)
      return
    }

    setExportingJobs(true)
    try {
      const response = await axios.get('/v1/jobs/export', {
        params: { format: 'xlsx', password: exportPassword },
        responseType: 'blob'
      })

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute(
        'download',
        `jobs-export-${new Date().toISOString().split('T')[0]}.xlsx`
      )
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Job export failed', error)
      setExportError(
        error?.response?.data?.detail ||
          'Failed to export jobs. Please try again.'
      )
    } finally {
      setExportingJobs(false)
      setExportPassword('')
      setPasswordPromptOpen(false)
    }
  }

  const handleBulkUpload = async (event) => {
    event.preventDefault()
    setUploadError('')
    setUploadMessage('')

    if (!bulkFile) {
      setUploadError('Please select a CSV or XLSX file before uploading.')
      return
    }

    const formData = new FormData()
    formData.append('file', bulkFile)

    setUploadingBulk(true)
    try {
      await axios.post('/v1/jobs/bulk', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setUploadMessage('Bulk jobs uploaded successfully.')
      setBulkFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      console.error('Bulk upload failed', error)
      setUploadError(
        error?.response?.data?.detail ||
          'Failed to upload jobs. Please review the file and try again.'
      )
    } finally {
      setUploadingBulk(false)
    }
  }

  const renderDataOpsTab = () => {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-2">Export Jobs</h3>
          <p className="text-sm text-gray-600 mb-4">
            Download the latest job postings in Excel format for offline audits
            or sharing.
          </p>
        <div className="mb-4 border border-dashed border-gray-200 rounded-lg p-4 bg-gray-50">
          <h4 className="text-sm font-semibold text-gray-800">
            Password protection required
          </h4>
          <p className="text-xs text-gray-500 mt-1">
            Admins must set a download password before exporting to ensure the
            XLSX file stays secure.
          </p>
          <button
            type="button"
            onClick={() => {
              setPasswordPromptOpen(true)
              setExportError('')
            }}
            className="mt-3 text-sm text-indigo-600 hover:underline"
          >
            Set password & export
          </button>
        </div>
          {exportError && (
            <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {exportError}
            </div>
          )}
        <button
          onClick={() => {
            if (!passwordPromptOpen) {
              setPasswordPromptOpen(true)
            }
          }}
          disabled={exportingJobs}
          className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {exportingJobs ? 'Preparing file...' : 'Export Jobs (.xlsx)'}
        </button>
        </div>

      {passwordPromptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-2">Protect Export</h3>
            <p className="text-sm text-gray-600 mb-4">
              Enter a password that will encrypt the XLSX download. Recipients
              must use it to open the file.
            </p>
            <input
              type="password"
              value={exportPassword}
              onChange={(e) => setExportPassword(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="Enter password"
            />
            <div className="flex gap-3 justify-end mt-4">
              <button
                type="button"
                onClick={() => {
                  setPasswordPromptOpen(false)
                  setExportPassword('')
                }}
                className="px-4 py-2 border rounded text-gray-600"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!exportPassword || exportingJobs}
                onClick={handleExportJobs}
                className="px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-60"
              >
                {exportingJobs ? 'Encrypting...' : 'Export with password'}
              </button>
            </div>
          </div>
        </div>
      )}

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-2">Bulk Job Upload</h3>
          <p className="text-sm text-gray-600 mb-4">
            Upload multiple job postings at once using a CSV or Excel template.
            Ensure required headings like title, department, location, and
            status are present.
          </p>
          <form className="space-y-4" onSubmit={handleBulkUpload}>
            <div>
              <input
                type="file"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                ref={fileInputRef}
                onChange={(e) => {
                  setBulkFile(e.target.files?.[0] || null)
                  setUploadError('')
                  setUploadMessage('')
                }}
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
              {bulkFile && (
                <div className="mt-2 text-sm text-gray-600">
                  Selected: <strong>{bulkFile.name}</strong>
                </div>
              )}
            </div>

            {uploadError && (
              <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {uploadError}
              </div>
            )}

            {uploadMessage && (
              <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                {uploadMessage}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={uploadingBulk}
                className="flex-1 rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-60"
              >
                {uploadingBulk ? 'Uploading...' : 'Upload Jobs'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setBulkFile(null)
                  setUploadError('')
                  setUploadMessage('')
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
                className="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Clear
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className="p-8">Loading settings...</div>
  }

  return (
    <div className="max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">System Settings</h1>
        <p className="text-gray-600">Configure your HR platform modules and preferences</p>
      </div>

      {saveMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
          {saveMessage}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Tabs Header */}
        <div className="border-b border-gray-200 bg-gray-50">
          <div className="flex overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-6 py-4 border-b-2 transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 bg-white'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                <span className="font-medium text-sm">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-8">
          {activeTab === 'organization' && renderOrganizationTab()}
          {activeTab === 'access' && renderAccessTab()}
          {activeTab === 'recruitment' && renderRecruitmentTab()}
          {activeTab === 'employee' && renderEmployeeTab()}
          {activeTab === 'payroll' && renderPayrollTab()}
          {activeTab === 'communications' && renderCommunicationsTab()}
          {activeTab === 'ai' && renderAITab()}
          {activeTab === 'integrations' && renderIntegrationsTab()}
          {activeTab === 'data' && renderDataOpsTab()}
        </div>
      </div>
    </div>
  )
}

export default Settings
