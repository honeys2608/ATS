import React, { useState, useEffect } from 'react'
import axios from '../api/axios'

function Finance() {
  const [activeTab, setActiveTab] = useState('invoices')
  const [loading, setLoading] = useState(true)
  
  const [invoices, setInvoices] = useState([])
  const [filterStatus, setFilterStatus] = useState('all')
  const [showCreateInvoiceModal, setShowCreateInvoiceModal] = useState(false)
  const [invoiceMetrics, setInvoiceMetrics] = useState({
    total_revenue: 0,
    pending_amount: 0,
    paid_amount: 0
  })
  const [newInvoice, setNewInvoice] = useState({
    client_name: '',
    amount: '',
    placements: [],
    due_date: ''
  })

  const [payrollRuns, setPayrollRuns] = useState([])
  const [selectedRun, setSelectedRun] = useState(null)
  const [payslips, setPayslips] = useState([])
  const [payrollMetrics, setPayrollMetrics] = useState({})
  const [showCreateRunModal, setShowCreateRunModal] = useState(false)
  const [newRun, setNewRun] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear() })

  const [employees, setEmployees] = useState([])
  const [salaries, setSalaries] = useState([])
  const [deductions, setDeductions] = useState([])
  const [showSalaryModal, setShowSalaryModal] = useState(false)
  const [showDeductionModal, setShowDeductionModal] = useState(false)
  const [newSalary, setNewSalary] = useState({
    employee_id: '',
    basic_salary: '',
    hra: '',
    transport_allowance: '',
    medical_allowance: '',
    special_allowance: ''
  })
  const [newDeduction, setNewDeduction] = useState({
    employee_id: '',
    deduction_type: 'tax',
    amount: '',
    description: '',
    is_percentage: false
  })

  useEffect(() => {
    if (activeTab === 'invoices') {
      loadInvoices()
    } else if (activeTab === 'payroll') {
      loadPayrollData()
    } else if (activeTab === 'salaries') {
      loadSalaryData()
    }
  }, [activeTab, filterStatus])

  const loadInvoices = async () => {
    try {
      const params = filterStatus !== 'all' ? { status: filterStatus } : {}
      const response = await axios.get('/v1/invoices', { params })
      const invoicesData = response.data || []
      setInvoices(invoicesData)
      
      const totalRevenue = invoicesData.reduce((sum, inv) => sum + (inv.amount || 0), 0)
      const paidAmount = invoicesData.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + (inv.amount || 0), 0)
      const pendingAmount = totalRevenue - paidAmount
      
      setInvoiceMetrics({ total_revenue: totalRevenue, pending_amount: pendingAmount, paid_amount: paidAmount })
      setLoading(false)
    } catch (error) {
      console.error('Error loading invoices:', error)
      setLoading(false)
    }
  }

  const loadPayrollData = async () => {
    try {
      const [runsRes, metricsRes] = await Promise.all([
        axios.get('/v1/payroll/runs'),
        axios.get('/v1/payroll/dashboard/metrics')
      ])
      setPayrollRuns(runsRes.data || [])
      setPayrollMetrics(metricsRes.data || {})
      setLoading(false)
    } catch (error) {
      console.error('Error loading payroll:', error)
      setLoading(false)
    }
  }

  const loadSalaryData = async () => {
    try {
      const [empsRes, salsRes, dedsRes] = await Promise.all([
        axios.get('/v1/employees'),
        axios.get('/v1/payroll/salaries'),
        axios.get('/v1/payroll/deductions')
      ])
      setEmployees(empsRes.data || [])
      setSalaries(salsRes.data || [])
      setDeductions(dedsRes.data || [])
      setLoading(false)
    } catch (error) {
      console.error('Error loading salary data:', error)
      setLoading(false)
    }
  }

  const createInvoice = async () => {
    try {
      await axios.post('/v1/invoices', {
        ...newInvoice,
        amount: parseFloat(newInvoice.amount),
        placements: []
      })
      setShowCreateInvoiceModal(false)
      setNewInvoice({ client_name: '', amount: '', placements: [], due_date: '' })
      loadInvoices()
    } catch (error) {
      console.error('Error creating invoice:', error)
    }
  }

  const updateInvoiceStatus = async (invoiceId, status) => {
    try {
      await axios.put(`/v1/invoices/${invoiceId}/status?status=${status}`)
      loadInvoices()
    } catch (error) {
      console.error('Error updating invoice status:', error)
    }
  }

  const createPayrollRun = async () => {
    try {
      await axios.post('/v1/payroll/runs', null, {
        params: { month: newRun.month, year: newRun.year }
      })
      setShowCreateRunModal(false)
      loadPayrollData()
    } catch (error) {
      console.error('Error creating payroll run:', error)
      alert(error.response?.data?.detail || 'Error creating payroll run')
    }
  }

  const viewPayslips = async (runId) => {
    try {
      const response = await axios.get(`/v1/payroll/payslips/${runId}`)
      setPayslips(response.data || [])
      setSelectedRun(runId)
    } catch (error) {
      console.error('Error loading payslips:', error)
    }
  }

  const createSalary = async () => {
    try {
      await axios.post('/v1/payroll/salaries', null, {
        params: {
          employee_id: newSalary.employee_id,
          basic_salary: parseFloat(newSalary.basic_salary),
          hra: parseFloat(newSalary.hra) || 0,
          transport_allowance: parseFloat(newSalary.transport_allowance) || 0,
          medical_allowance: parseFloat(newSalary.medical_allowance) || 0,
          special_allowance: parseFloat(newSalary.special_allowance) || 0
        }
      })
      setShowSalaryModal(false)
      setNewSalary({ employee_id: '', basic_salary: '', hra: '', transport_allowance: '', medical_allowance: '', special_allowance: '' })
      loadSalaryData()
    } catch (error) {
      console.error('Error creating salary:', error)
    }
  }

  const createDeduction = async () => {
    try {
      await axios.post('/v1/payroll/deductions', null, {
        params: {
          employee_id: newDeduction.employee_id,
          deduction_type: newDeduction.deduction_type,
          amount: parseFloat(newDeduction.amount),
          description: newDeduction.description,
          is_percentage: newDeduction.is_percentage,
          is_recurring: true
        }
      })
      setShowDeductionModal(false)
      setNewDeduction({ employee_id: '', deduction_type: 'tax', amount: '', description: '', is_percentage: false })
      loadSalaryData()
    } catch (error) {
      console.error('Error creating deduction:', error)
    }
  }

  const getStatusBadge = (status) => {
    const badges = {
      draft: 'bg-gray-100 text-gray-700',
      sent: 'bg-blue-100 text-blue-700',
      paid: 'bg-green-100 text-green-700',
      overdue: 'bg-red-100 text-red-700',
      pending: 'bg-yellow-100 text-yellow-700',
      completed: 'bg-green-100 text-green-700'
    }
    return badges[status] || badges.draft
  }

  if (loading) {
    return <div className="text-center py-12">Loading finance data...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Finance Management</h1>
      </div>

      <div className="bg-white p-2 rounded-lg shadow mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('invoices')}
            className={`px-6 py-3 rounded-lg font-semibold transition ${
              activeTab === 'invoices' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Invoices
          </button>
          <button
            onClick={() => setActiveTab('payroll')}
            className={`px-6 py-3 rounded-lg font-semibold transition ${
              activeTab === 'payroll' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Payroll Runs
          </button>
          <button
            onClick={() => setActiveTab('salaries')}
            className={`px-6 py-3 rounded-lg font-semibold transition ${
              activeTab === 'salaries' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Salaries & Deductions
          </button>
        </div>
      </div>

      {activeTab === 'invoices' && (
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setShowCreateInvoiceModal(true)}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition"
            >
              Create Invoice
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-lg shadow-lg text-white">
              <div className="text-sm opacity-90">Total Revenue</div>
              <div className="text-3xl font-bold mt-2">${invoiceMetrics.total_revenue.toLocaleString()}</div>
            </div>
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-6 rounded-lg shadow-lg text-white">
              <div className="text-sm opacity-90">Paid Amount</div>
              <div className="text-3xl font-bold mt-2">${invoiceMetrics.paid_amount.toLocaleString()}</div>
            </div>
            <div className="bg-gradient-to-br from-orange-500 to-red-600 p-6 rounded-lg shadow-lg text-white">
              <div className="text-sm opacity-90">Pending Amount</div>
              <div className="text-3xl font-bold mt-2">${invoiceMetrics.pending_amount.toLocaleString()}</div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <div className="flex gap-3">
              {['all', 'draft', 'sent', 'paid', 'overdue'].map(status => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-4 py-2 rounded capitalize ${filterStatus === status ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  {status === 'all' ? 'All Invoices' : status}
                </button>
              ))}
            </div>
          </div>

          {invoices.length === 0 ? (
            <div className="bg-white p-12 rounded-lg shadow text-center">
              <p className="text-gray-500 text-lg">No invoices found</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{invoice.invoice_number}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{invoice.client_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">${invoice.amount?.toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(invoice.status)}`}>
                          {invoice.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex gap-2">
                          {invoice.status === 'draft' && (
                            <button onClick={() => updateInvoiceStatus(invoice.id, 'sent')} className="text-blue-600 hover:text-blue-900">Send</button>
                          )}
                          {invoice.status === 'sent' && (
                            <button onClick={() => updateInvoiceStatus(invoice.id, 'paid')} className="text-green-600 hover:text-green-900">Mark Paid</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'payroll' && (
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setShowCreateRunModal(true)}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition"
            >
              Create Payroll Run
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-6 rounded-lg shadow-lg text-white">
              <div className="text-sm opacity-90">Total Employees</div>
              <div className="text-3xl font-bold mt-2">{payrollMetrics.total_employees || 0}</div>
            </div>
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-6 rounded-lg shadow-lg text-white">
              <div className="text-sm opacity-90">Monthly Payroll</div>
              <div className="text-3xl font-bold mt-2">${(payrollMetrics.total_monthly_payroll || 0).toLocaleString()}</div>
            </div>
            <div className="bg-gradient-to-br from-orange-500 to-red-600 p-6 rounded-lg shadow-lg text-white">
              <div className="text-sm opacity-90">Pending Payments</div>
              <div className="text-3xl font-bold mt-2">{payrollMetrics.pending_payments || 0}</div>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-pink-600 p-6 rounded-lg shadow-lg text-white">
              <div className="text-sm opacity-90">Pending Amount</div>
              <div className="text-3xl font-bold mt-2">${(payrollMetrics.pending_amount || 0).toLocaleString()}</div>
            </div>
          </div>

          {payrollRuns.length === 0 ? (
            <div className="bg-white p-12 rounded-lg shadow text-center">
              <p className="text-gray-500 text-lg">No payroll runs found</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employees</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gross</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deductions</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Net Pay</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payrollRuns.map((run) => (
                    <tr key={run.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{run.period_display}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{run.total_employees}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">${run.total_gross?.toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">${run.total_deductions?.toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">${run.total_net?.toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(run.status)}`}>
                          {run.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button onClick={() => viewPayslips(run.id)} className="text-indigo-600 hover:text-indigo-900">
                          View Payslips
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedRun && payslips.length > 0 && (
            <div className="mt-8 bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold mb-4">Payslips</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Basic</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">HRA</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gross</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deductions</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Net Pay</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {payslips.map((slip) => (
                      <tr key={slip.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">
                          <div className="font-medium">{slip.employee_name}</div>
                          <div className="text-gray-500 text-xs">{slip.designation}</div>
                        </td>
                        <td className="px-4 py-3 text-sm">${slip.basic_salary?.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm">${slip.hra?.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm font-semibold">${slip.gross_salary?.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-red-600">${slip.total_deductions?.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm font-bold text-green-600">${slip.net_salary?.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(slip.payment_status)}`}>
                            {slip.payment_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'salaries' && (
        <div>
          <div className="flex justify-end gap-3 mb-4">
            <button
              onClick={() => setShowSalaryModal(true)}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition"
            >
              Add Salary
            </button>
            <button
              onClick={() => setShowDeductionModal(true)}
              className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition"
            >
              Add Deduction
            </button>
          </div>

          <div className="bg-white rounded-lg shadow mb-6">
            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-bold">Employee Salaries</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Basic</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">HRA</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transport</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Medical</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gross</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {salaries.map((salary) => (
                    <tr key={salary.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm">
                        <div className="font-medium">{salary.employee_name}</div>
                        <div className="text-gray-500 text-xs">{salary.designation}</div>
                      </td>
                      <td className="px-6 py-4 text-sm">${salary.basic_salary?.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm">${salary.hra?.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm">${salary.transport_allowance?.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm">${salary.medical_allowance?.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm font-semibold">${salary.gross_salary?.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${salary.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                          {salary.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-bold">Deductions</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recurring</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {deductions.map((ded) => (
                    <tr key={ded.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium">{ded.employee_name}</td>
                      <td className="px-6 py-4 text-sm capitalize">{ded.deduction_type.replace('_', ' ')}</td>
                      <td className="px-6 py-4 text-sm">{ded.description || '-'}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-red-600">
                        {ded.is_percentage ? `${ded.amount}%` : `$${ded.amount?.toLocaleString()}`}
                      </td>
                      <td className="px-6 py-4 text-sm">{ded.is_recurring ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showCreateInvoiceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">Create New Invoice</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Client Name</label>
                <input
                  type="text"
                  value={newInvoice.client_name}
                  onChange={(e) => setNewInvoice({...newInvoice, client_name: e.target.value})}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Amount ($)</label>
                <input
                  type="number"
                  value={newInvoice.amount}
                  onChange={(e) => setNewInvoice({...newInvoice, amount: e.target.value})}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Due Date</label>
                <input
                  type="date"
                  value={newInvoice.due_date}
                  onChange={(e) => setNewInvoice({...newInvoice, due_date: e.target.value})}
                  className="w-full p-2 border rounded"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={createInvoice} className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">
                Create
              </button>
              <button onClick={() => setShowCreateInvoiceModal(false)} className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateRunModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">Create Payroll Run</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Month</label>
                <select
                  value={newRun.month}
                  onChange={(e) => setNewRun({...newRun, month: parseInt(e.target.value)})}
                  className="w-full p-2 border rounded"
                >
                  {Array.from({length: 12}, (_, i) => (
                    <option key={i+1} value={i+1}>{new Date(2000, i).toLocaleString('default', { month: 'long' })}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Year</label>
                <input
                  type="number"
                  value={newRun.year}
                  onChange={(e) => setNewRun({...newRun, year: parseInt(e.target.value)})}
                  className="w-full p-2 border rounded"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={createPayrollRun} className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">
                Create Run
              </button>
              <button onClick={() => setShowCreateRunModal(false)} className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showSalaryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Add Employee Salary</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Employee</label>
                <select
                  value={newSalary.employee_id}
                  onChange={(e) => setNewSalary({...newSalary, employee_id: e.target.value})}
                  className="w-full p-2 border rounded"
                >
                  <option value="">Select Employee</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.full_name} - {emp.employee_code}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Basic Salary ($)</label>
                <input
                  type="number"
                  value={newSalary.basic_salary}
                  onChange={(e) => setNewSalary({...newSalary, basic_salary: e.target.value})}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">HRA ($)</label>
                <input
                  type="number"
                  value={newSalary.hra}
                  onChange={(e) => setNewSalary({...newSalary, hra: e.target.value})}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Transport Allowance ($)</label>
                <input
                  type="number"
                  value={newSalary.transport_allowance}
                  onChange={(e) => setNewSalary({...newSalary, transport_allowance: e.target.value})}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Medical Allowance ($)</label>
                <input
                  type="number"
                  value={newSalary.medical_allowance}
                  onChange={(e) => setNewSalary({...newSalary, medical_allowance: e.target.value})}
                  className="w-full p-2 border rounded"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={createSalary} className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">
                Add Salary
              </button>
              <button onClick={() => setShowSalaryModal(false)} className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeductionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">Add Deduction</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Employee</label>
                <select
                  value={newDeduction.employee_id}
                  onChange={(e) => setNewDeduction({...newDeduction, employee_id: e.target.value})}
                  className="w-full p-2 border rounded"
                >
                  <option value="">Select Employee</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.full_name} - {emp.employee_code}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Type</label>
                <select
                  value={newDeduction.deduction_type}
                  onChange={(e) => setNewDeduction({...newDeduction, deduction_type: e.target.value})}
                  className="w-full p-2 border rounded"
                >
                  <option value="tax">Tax</option>
                  <option value="provident_fund">Provident Fund</option>
                  <option value="insurance">Insurance</option>
                  <option value="loan">Loan Repayment</option>
                  <option value="advance">Advance Recovery</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Amount</label>
                <input
                  type="number"
                  value={newDeduction.amount}
                  onChange={(e) => setNewDeduction({...newDeduction, amount: e.target.value})}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Description</label>
                <input
                  type="text"
                  value={newDeduction.description}
                  onChange={(e) => setNewDeduction({...newDeduction, description: e.target.value})}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={newDeduction.is_percentage}
                  onChange={(e) => setNewDeduction({...newDeduction, is_percentage: e.target.checked})}
                  className="mr-2"
                />
                <label className="text-sm">Is Percentage of Gross Salary</label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={createDeduction} className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">
                Add Deduction
              </button>
              <button onClick={() => setShowDeductionModal(false)} className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Finance
