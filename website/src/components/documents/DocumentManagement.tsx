import React, { useState } from 'react';
import {
  Upload, FileText, Image, File, CheckCircle2, XCircle,
  Clock, Search, Filter, Eye, Download, Trash2
} from 'lucide-react';

interface Doc {
  id: number;
  name: string;
  type: string;
  category: string;
  size: string;
  status: 'verified' | 'pending' | 'rejected';
  uploadedAt: string;
}

const sampleDocs: Doc[] = [
  { id: 1, name: 'O-Level Certificate.pdf', type: 'pdf', category: 'Certificate', size: '1.2 MB', status: 'verified', uploadedAt: '2022-09-01' },
  { id: 2, name: 'Birth Certificate.pdf', type: 'pdf', category: 'Identity', size: '0.8 MB', status: 'verified', uploadedAt: '2022-09-01' },
  { id: 3, name: 'Passport Photo.jpg', type: 'image', category: 'Photo', size: '0.3 MB', status: 'verified', uploadedAt: '2022-09-01' },
  { id: 4, name: 'JAMB Result.pdf', type: 'pdf', category: 'Certificate', size: '0.5 MB', status: 'verified', uploadedAt: '2022-09-02' },
  { id: 5, name: 'Medical Report.pdf', type: 'pdf', category: 'Medical', size: '2.1 MB', status: 'pending', uploadedAt: '2026-03-15' },
  { id: 6, name: 'Recommendation Letter.pdf', type: 'pdf', category: 'Letter', size: '0.4 MB', status: 'pending', uploadedAt: '2026-04-01' },
];

export default function DocumentManagement() {
  const [docs, setDocs] = useState<Doc[]>(sampleDocs);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const filtered = docs.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const statusColors = {
    verified: 'bg-emerald-50 text-emerald-700',
    pending: 'bg-amber-50 text-amber-700',
    rejected: 'bg-red-50 text-red-700',
  };

  const statusIcons = {
    verified: <CheckCircle2 size={12} />,
    pending: <Clock size={12} />,
    rejected: <XCircle size={12} />,
  };

  function handleVerify(id: number) {
    setDocs(docs.map(d => d.id === id ? { ...d, status: 'verified' as const } : d));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Document Management</h2>
          <p className="text-sm text-gray-500">Upload, manage, and verify student documents</p>
        </div>
        <button onClick={() => setShowUpload(!showUpload)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#422e59] text-white rounded-xl text-sm font-medium hover:bg-[#322244] transition-colors shadow-lg shadow-blue-500/20">
          <Upload size={16} /> Upload Document
        </button>
      </div>

      {/* Upload Area */}
      {showUpload && (
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-gray-50'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); }}
        >
          <Upload size={32} className="mx-auto text-gray-400 mb-3" />
          <p className="text-sm text-gray-600 font-medium">Drag and drop files here, or click to browse</p>
          <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG up to 10MB each</p>
          <input type="file" className="hidden" id="file-upload" multiple />
          <label htmlFor="file-upload"
            className="inline-block mt-3 px-4 py-2 bg-[#422e59] text-white rounded-lg text-sm font-medium cursor-pointer hover:bg-[#322244] transition-colors">
            Browse Files
          </label>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="Search documents..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="text-2xl font-bold text-emerald-600">{docs.filter(d => d.status === 'verified').length}</p>
          <p className="text-xs text-gray-500">Verified</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="text-2xl font-bold text-amber-600">{docs.filter(d => d.status === 'pending').length}</p>
          <p className="text-xs text-gray-500">Pending</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="text-2xl font-bold text-gray-600">{docs.length}</p>
          <p className="text-xs text-gray-500">Total</p>
        </div>
      </div>

      {/* Document List */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Document</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Category</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Size</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Uploaded</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((doc) => (
              <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${doc.type === 'image' ? 'bg-purple-50 text-purple-500' : 'bg-blue-50 text-blue-500'}`}>
                      {doc.type === 'image' ? <Image size={16} /> : <FileText size={16} />}
                    </div>
                    <span className="text-sm font-medium text-gray-700">{doc.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-sm text-gray-500">{doc.category}</td>
                <td className="px-5 py-3 text-sm text-gray-500">{doc.size}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${statusColors[doc.status]}`}>
                    {statusIcons[doc.status]} {doc.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-sm text-gray-500">{doc.uploadedAt}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Eye size={14} />
                    </button>
                    <button className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                      <Download size={14} />
                    </button>
                    {doc.status === 'pending' && (
                      <button onClick={() => handleVerify(doc.id)}
                        className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Verify">
                        <CheckCircle2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
