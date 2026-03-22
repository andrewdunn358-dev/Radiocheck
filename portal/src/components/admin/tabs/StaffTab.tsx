'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, RefreshCw, Edit, Trash2, Key, X } from 'lucide-react';
import { api } from '@/lib/admin-api';
import type { StaffMember } from '@/types/admin';

interface StaffTabProps {
  token: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export default function StaffTab({ token, onSuccess, onError }: StaffTabProps) {
  // Staff state
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffFilter, setStaffFilter] = useState('');
  const [staffRoleFilter, setStaffRoleFilter] = useState('all');
  
  // Modal state
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [newStaff, setNewStaff] = useState({
    email: '',
    password: '',
    name: '',
    role: 'peer' as 'admin' | 'supervisor' | 'counsellor' | 'peer',
    phone: '',
    specialization: '',
    area: '',
  });
  
  // Reset Password Modal state
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<{ id: string; name: string } | null>(null);
  const [resetPasswordData, setResetPasswordData] = useState({ newPassword: '', confirmPassword: '' });

  // Load staff on mount and when filter changes
  const loadStaff = useCallback(async () => {
    if (!token) return;
    try {
      // First try the new unified staff endpoint
      const data = await api.getStaff(token, staffRoleFilter !== 'all' ? staffRoleFilter : undefined);
      if (Array.isArray(data) && data.length > 0) {
        setStaff(data);
        return;
      }
      
      // If new endpoint returns empty, try the admin unified-staff view
      const unifiedData = await api.getUnifiedStaff(token).catch(() => []);
      if (Array.isArray(unifiedData) && unifiedData.length > 0) {
        const mappedData = unifiedData.map((u: any) => ({
          id: u.user_id || u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          status: u.profile?.status || 'offline',
          phone: u.profile?.phone || '',
          specialization: u.profile?.specialization || '',
          area: u.profile?.area || '',
          background: u.profile?.background || '',
          _source: 'unified',
          has_profile: u.has_profile,
          created_at: u.created_at,
        }));
        const filtered = staffRoleFilter === 'all' 
          ? mappedData 
          : mappedData.filter((s: any) => s.role === staffRoleFilter);
        setStaff(filtered);
        return;
      }
      
      // Fallback to legacy endpoints
      const [counsellors, peers] = await Promise.all([
        api.getCounsellors(token).catch(() => []),
        api.getPeerSupporters(token).catch(() => []),
      ]);
      const combined = [
        ...(Array.isArray(counsellors) ? counsellors : []).map((c: any) => ({ 
          id: c.id, email: c.email || '', name: c.name, role: 'counsellor',
          status: c.status || 'offline', phone: c.phone || '',
          specialization: c.specialization || '', _source: 'counsellors' 
        })),
        ...(Array.isArray(peers) ? peers : []).map((p: any) => ({ 
          id: p.id, email: p.email || '', name: p.firstName || p.name, role: 'peer',
          status: p.status || 'offline', phone: p.phone || '',
          area: p.area || '', background: p.background || '', _source: 'peer_supporters' 
        })),
      ];
      const filtered = staffRoleFilter === 'all' 
        ? combined 
        : combined.filter((s: any) => s.role === staffRoleFilter);
      setStaff(filtered as StaffMember[]);
    } catch (err: any) {
      console.error('Failed to load staff:', err);
      setStaff([]);
    }
  }, [token, staffRoleFilter]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  // Filter staff
  const filteredStaff = staff.filter(s => {
    const matchesSearch = !staffFilter || 
      s.name?.toLowerCase().includes(staffFilter.toLowerCase()) ||
      s.email?.toLowerCase().includes(staffFilter.toLowerCase());
    const matchesRole = staffRoleFilter === 'all' || s.role === staffRoleFilter;
    return matchesSearch && matchesRole;
  });

  // CRUD handlers
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    
    try {
      await api.createStaff(token, newStaff);
      onSuccess('Staff member created successfully');
      setShowAddStaffModal(false);
      setNewStaff({ email: '', password: '', name: '', role: 'peer', phone: '', specialization: '', area: '' });
      await loadStaff();
    } catch (err: any) {
      onError(err.message);
    }
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingStaff) return;
    
    try {
      await api.updateStaff(token, editingStaff.id, editingStaff);
      onSuccess('Staff member updated successfully');
      setEditingStaff(null);
      await loadStaff();
    } catch (err: any) {
      onError(err.message);
    }
  };

  const handleDeleteStaff = async (id: string) => {
    if (!token) return;
    if (!confirm('Are you sure you want to delete this staff member?')) return;
    
    try {
      await api.deleteStaff(token, id);
      onSuccess('Staff member deleted');
      await loadStaff();
    } catch (err: any) {
      onError(err.message);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetPasswordData.newPassword.length < 8) {
      onError('Password must be at least 8 characters');
      return;
    }
    if (resetPasswordData.newPassword !== resetPasswordData.confirmPassword) {
      onError('Passwords do not match');
      return;
    }
    try {
      await api.adminResetPassword(token!, resetPasswordUser!.id, resetPasswordData.newPassword);
      onSuccess('Password reset successfully');
      setShowResetPasswordModal(false);
      setResetPasswordUser(null);
      setResetPasswordData({ newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      onError('Failed to reset password: ' + err.message);
    }
  };

  return (
    <div data-testid="staff-tab">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search staff..."
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 outline-none"
            />
          </div>
        </div>
        <select
          value={staffRoleFilter}
          onChange={(e) => setStaffRoleFilter(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 outline-none"
        >
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="supervisor">Supervisor</option>
          <option value="counsellor">Counsellor</option>
          <option value="peer">Peer Supporter</option>
        </select>
        <button
          onClick={() => setShowAddStaffModal(true)}
          data-testid="add-staff-btn"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Staff
        </button>
        <button
          onClick={loadStaff}
          className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Staff Table */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Name</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Email</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Role</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {filteredStaff.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  No staff members found
                </td>
              </tr>
            ) : (
              filteredStaff.map((member) => (
                <tr key={member.id} className="hover:bg-gray-700/50" data-testid={`staff-row-${member.id}`}>
                  <td className="px-4 py-3">
                    <div>
                      <span className="font-medium">{member.name}</span>
                      {member._source && (
                        <span className="ml-2 text-xs text-gray-500">({member._source})</span>
                      )}
                      {member.role !== 'admin' && (
                        member.has_profile ? (
                          <p className="text-xs text-green-500 mt-1">Linked to profile</p>
                        ) : (
                          <p className="text-xs text-gray-500 mt-1">No profile linked</p>
                        )
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{member.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      member.role === 'admin' ? 'bg-purple-500/20 text-purple-400' :
                      member.role === 'supervisor' ? 'bg-blue-500/20 text-blue-400' :
                      member.role === 'counsellor' ? 'bg-green-500/20 text-green-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {member.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {['available', 'busy', 'unavailable'].map((status) => (
                        <button
                          key={status}
                          onClick={async () => {
                            try {
                              await api.updateStaffStatus(token!, member.id, status);
                              onSuccess('Status updated');
                              loadStaff();
                            } catch (err: any) { onError(err.message); }
                          }}
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                            member.status === status || (status === 'unavailable' && member.status === 'off')
                              ? status === 'available' ? 'bg-green-500 text-white' 
                                : status === 'busy' ? 'bg-yellow-500 text-white' 
                                : 'bg-gray-500 text-white'
                              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                          }`}
                        >
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingStaff(member)}
                        className="p-1 hover:bg-gray-600 rounded"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4 text-blue-400" />
                      </button>
                      {member.role !== 'admin' && (
                        <button
                          onClick={() => {
                            setResetPasswordUser({ id: member.id, name: member.name });
                            setResetPasswordData({ newPassword: '', confirmPassword: '' });
                            setShowResetPasswordModal(true);
                          }}
                          className="p-1 hover:bg-gray-600 rounded"
                          title="Reset Password"
                        >
                          <Key className="w-4 h-4 text-yellow-400" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteStaff(member.id)}
                        className="p-1 hover:bg-gray-600 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Staff Modal */}
      {showAddStaffModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700">
            <h2 className="text-xl font-bold mb-4">Add New Staff Member</h2>
            <form onSubmit={handleCreateStaff}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Email *</label>
                  <input
                    type="email"
                    value={newStaff.email}
                    onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Password *</label>
                  <input
                    type="password"
                    value={newStaff.password}
                    onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Name *</label>
                  <input
                    type="text"
                    value={newStaff.name}
                    onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Role *</label>
                  <select
                    value={newStaff.role}
                    onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value as any })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  >
                    <option value="peer">Peer Supporter</option>
                    <option value="counsellor">Counsellor</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={newStaff.phone}
                    onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  />
                </div>
                {(newStaff.role === 'counsellor' || newStaff.role === 'supervisor') && (
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Specialization</label>
                    <input
                      type="text"
                      value={newStaff.specialization}
                      onChange={(e) => setNewStaff({ ...newStaff, specialization: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      placeholder="e.g., PTSD, Anxiety"
                    />
                  </div>
                )}
                {newStaff.role === 'peer' && (
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Service Area</label>
                    <input
                      type="text"
                      value={newStaff.area}
                      onChange={(e) => setNewStaff({ ...newStaff, area: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      placeholder="e.g., Army, Navy"
                    />
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  Create Staff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {editingStaff && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-2xl border border-gray-700 my-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Edit Staff Profile</h2>
              <button onClick={() => setEditingStaff(null)} className="p-1 hover:bg-gray-700 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateStaff}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <h3 className="text-sm font-semibold text-blue-400 mb-2 pb-1 border-b border-gray-700">Basic Information</h3>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    value={editingStaff.name}
                    onChange={(e) => setEditingStaff({ ...editingStaff, name: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={editingStaff.email}
                    disabled
                    className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-gray-400 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Role</label>
                  <input
                    type="text"
                    value={editingStaff.role}
                    disabled
                    className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-gray-400 cursor-not-allowed capitalize"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Status</label>
                  <select
                    value={editingStaff.status}
                    onChange={(e) => setEditingStaff({ ...editingStaff, status: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500"
                  >
                    <option value="available">Available</option>
                    <option value="busy">Busy</option>
                    <option value="unavailable">Unavailable</option>
                  </select>
                </div>

                <div className="col-span-2 mt-4">
                  <h3 className="text-sm font-semibold text-blue-400 mb-2 pb-1 border-b border-gray-700">Contact Information</h3>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={editingStaff.phone || ''}
                    onChange={(e) => setEditingStaff({ ...editingStaff, phone: e.target.value })}
                    placeholder="e.g., 07700 900123"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">SMS Number</label>
                  <input
                    type="tel"
                    value={editingStaff.sms || ''}
                    onChange={(e) => setEditingStaff({ ...editingStaff, sms: e.target.value })}
                    placeholder="Leave blank if same as phone"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">WhatsApp Number</label>
                  <input
                    type="tel"
                    value={editingStaff.whatsapp || ''}
                    onChange={(e) => setEditingStaff({ ...editingStaff, whatsapp: e.target.value })}
                    placeholder="Leave blank if same as phone"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500"
                  />
                </div>

                <div className="col-span-2 mt-4">
                  <h3 className="text-sm font-semibold text-blue-400 mb-2 pb-1 border-b border-gray-700">
                    {editingStaff.role === 'counsellor' ? 'Counsellor Details' : 
                     editingStaff.role === 'peer' ? 'Peer Supporter Details' : 'Professional Details'}
                  </h3>
                </div>

                {(editingStaff.role === 'counsellor' || editingStaff.role === 'supervisor') && (
                  <div className="col-span-2">
                    <label className="block text-sm text-gray-400 mb-1">Specialization</label>
                    <input
                      type="text"
                      value={editingStaff.specialization || ''}
                      onChange={(e) => setEditingStaff({ ...editingStaff, specialization: e.target.value })}
                      placeholder="e.g., PTSD, Anxiety, Trauma"
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500"
                    />
                  </div>
                )}

                {editingStaff.role === 'peer' && (
                  <>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Service Area</label>
                      <input
                        type="text"
                        value={editingStaff.area || ''}
                        onChange={(e) => setEditingStaff({ ...editingStaff, area: e.target.value })}
                        placeholder="e.g., North West, London"
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Years Served</label>
                      <input
                        type="text"
                        value={editingStaff.years_served || ''}
                        onChange={(e) => setEditingStaff({ ...editingStaff, years_served: e.target.value })}
                        placeholder="e.g., 1990-2005"
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm text-gray-400 mb-1">Military Background</label>
                      <textarea
                        value={editingStaff.background || ''}
                        onChange={(e) => setEditingStaff({ ...editingStaff, background: e.target.value })}
                        placeholder="e.g., Royal Marines, served 15 years..."
                        rows={3}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 resize-none"
                      />
                    </div>
                  </>
                )}

                <div className="col-span-2 flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    id="is_supervisor"
                    checked={editingStaff.is_supervisor || false}
                    onChange={(e) => setEditingStaff({ ...editingStaff, is_supervisor: e.target.checked })}
                    className="w-4 h-4 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="is_supervisor" className="text-sm text-gray-300">
                    Has supervisor privileges (can view all safeguarding alerts)
                  </label>
                </div>
              </div>
              
              <div className="flex gap-3 mt-6 pt-4 border-t border-gray-700">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetPasswordModal && resetPasswordUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Reset Password for {resetPasswordUser.name}</h2>
              <button onClick={() => setShowResetPasswordModal(false)} className="p-1 hover:bg-gray-700 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleResetPassword}>
              <p className="text-sm text-gray-400 mb-4">
                Password must be at least 8 characters and cannot match any of the last 3 passwords used.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">New Password *</label>
                  <input
                    type="password"
                    value={resetPasswordData.newPassword}
                    onChange={(e) => setResetPasswordData({ ...resetPasswordData, newPassword: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    placeholder="Minimum 8 characters"
                    minLength={8}
                    required
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Confirm Password *</label>
                  <input
                    type="password"
                    value={resetPasswordData.confirmPassword}
                    onChange={(e) => setResetPasswordData({ ...resetPasswordData, confirmPassword: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    placeholder="Re-enter password"
                    minLength={8}
                    required
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetPasswordModal(false);
                    setResetPasswordUser(null);
                    setResetPasswordData({ newPassword: '', confirmPassword: '' });
                  }}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors"
                >
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
