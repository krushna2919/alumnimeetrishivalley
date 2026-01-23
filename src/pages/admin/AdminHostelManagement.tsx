import { useState, useEffect, useMemo } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Bed, Users, Building2, Edit, Loader2 } from 'lucide-react';
import GroupedApplicantSelector from '@/components/admin/hostel/GroupedApplicantSelector';
import BedAssignmentGrid from '@/components/admin/hostel/BedAssignmentGrid';

interface Hostel {
  id: string;
  name: string;
  total_rooms: number;
  beds_per_room: number;
  washrooms: number;
}

interface Room {
  id: string;
  hostel_id: string;
  room_number: string;
  beds_count: number;
}

interface BedAssignment {
  id: string;
  room_id: string;
  bed_number: number;
  registration_id: string | null;
  registration?: {
    id: string;
    name: string;
    application_id: string;
  };
}

interface Registration {
  id: string;
  name: string;
  application_id: string;
  parent_application_id: string | null;
  hostel_name: string | null;
}

const AdminHostelManagement = () => {
  const { toast } = useToast();
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bedAssignments, setBedAssignments] = useState<BedAssignment[]>([]);
  const [allRegistrations, setAllRegistrations] = useState<Registration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddHostelOpen, setIsAddHostelOpen] = useState(false);
  const [isEditHostelOpen, setIsEditHostelOpen] = useState(false);
  const [editingHostel, setEditingHostel] = useState<Hostel | null>(null);
  const [selectedApplicantIds, setSelectedApplicantIds] = useState<string[]>([]);
  const [selectedBedIds, setSelectedBedIds] = useState<string[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);
  const [newHostel, setNewHostel] = useState({
    name: '',
    total_rooms: 0,
    beds_per_room: 1,
    washrooms: 0,
  });

  // Computed values
  const assignedRegistrationIds = useMemo(() => {
    return new Set(
      bedAssignments.filter((a) => a.registration_id).map((a) => a.registration_id!)
    );
  }, [bedAssignments]);

  const availableRegistrations = useMemo(() => {
    return allRegistrations.filter((r) => !assignedRegistrationIds.has(r.id));
  }, [allRegistrations, assignedRegistrationIds]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [hostelsRes, roomsRes, assignmentsRes, registrationsRes] = await Promise.all([
        supabase.from('hostels').select('*').order('name'),
        supabase.from('hostel_rooms').select('*').order('room_number'),
        supabase.from('bed_assignments').select('*, registration:registrations(id, name, application_id)'),
        supabase.from('registrations').select('id, name, application_id, parent_application_id, hostel_name')
          .eq('registration_status', 'approved')
          .eq('stay_type', 'on-campus'),
      ]);

      if (hostelsRes.error) throw hostelsRes.error;
      if (roomsRes.error) throw roomsRes.error;
      if (assignmentsRes.error) throw assignmentsRes.error;
      if (registrationsRes.error) throw registrationsRes.error;

      setHostels(hostelsRes.data || []);
      setRooms(roomsRes.data || []);
      setBedAssignments(assignmentsRes.data || []);
      setAllRegistrations(registrationsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch hostel data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddHostel = async () => {
    if (!newHostel.name.trim()) {
      toast({ title: 'Error', description: 'Hostel name is required', variant: 'destructive' });
      return;
    }

    try {
      const { data: hostelData, error: hostelError } = await supabase
        .from('hostels')
        .insert({
          name: newHostel.name.trim(),
          total_rooms: newHostel.total_rooms,
          beds_per_room: newHostel.beds_per_room,
          washrooms: newHostel.washrooms,
        })
        .select()
        .single();

      if (hostelError) throw hostelError;

      // Create rooms and beds
      if (newHostel.total_rooms > 0) {
        const roomsToCreate = Array.from({ length: newHostel.total_rooms }, (_, i) => ({
          hostel_id: hostelData.id,
          room_number: `${i + 1}`,
          beds_count: newHostel.beds_per_room,
        }));

        const { data: roomsData, error: roomsError } = await supabase
          .from('hostel_rooms')
          .insert(roomsToCreate)
          .select();

        if (roomsError) throw roomsError;

        // Create beds for each room
        const bedsToCreate = roomsData.flatMap(room =>
          Array.from({ length: newHostel.beds_per_room }, (_, i) => ({
            room_id: room.id,
            bed_number: i + 1,
          }))
        );

        if (bedsToCreate.length > 0) {
          const { error: bedsError } = await supabase
            .from('bed_assignments')
            .insert(bedsToCreate);

          if (bedsError) throw bedsError;
        }
      }

      toast({ title: 'Success', description: 'Hostel added successfully' });
      setIsAddHostelOpen(false);
      setNewHostel({ name: '', total_rooms: 0, beds_per_room: 1, washrooms: 0 });
      fetchData();
    } catch (error: any) {
      console.error('Error adding hostel:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add hostel',
        variant: 'destructive',
      });
    }
  };

  const handleEditHostel = async () => {
    if (!editingHostel) return;

    try {
      const { error } = await supabase
        .from('hostels')
        .update({
          name: editingHostel.name,
          washrooms: editingHostel.washrooms,
        })
        .eq('id', editingHostel.id);

      if (error) throw error;

      toast({ title: 'Success', description: 'Hostel updated successfully' });
      setIsEditHostelOpen(false);
      setEditingHostel(null);
      fetchData();
    } catch (error: any) {
      console.error('Error updating hostel:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update hostel',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteHostel = async (hostelId: string) => {
    if (!confirm('Are you sure you want to delete this hostel? All rooms and assignments will be removed.')) {
      return;
    }

    try {
      const { error } = await supabase.from('hostels').delete().eq('id', hostelId);
      if (error) throw error;

      toast({ title: 'Success', description: 'Hostel deleted successfully' });
      fetchData();
    } catch (error: any) {
      console.error('Error deleting hostel:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete hostel',
        variant: 'destructive',
      });
    }
  };

  const handleAssignBed = async (bedAssignmentId: string, registrationId: string | null) => {
    try {
      const { error } = await supabase
        .from('bed_assignments')
        .update({ registration_id: registrationId })
        .eq('id', bedAssignmentId);

      if (error) throw error;

      toast({ title: 'Success', description: registrationId ? 'Bed assigned successfully' : 'Bed unassigned' });
      fetchData();
    } catch (error: any) {
      console.error('Error assigning bed:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to assign bed',
        variant: 'destructive',
      });
    }
  };

  // Bulk assign selected applicants to selected beds
  const handleBulkAssign = async () => {
    if (selectedApplicantIds.length === 0 || selectedBedIds.length === 0) {
      toast({
        title: 'Selection Required',
        description: 'Please select both applicants and beds to assign',
        variant: 'destructive',
      });
      return;
    }

    if (selectedApplicantIds.length > selectedBedIds.length) {
      toast({
        title: 'Not Enough Beds',
        description: `Selected ${selectedApplicantIds.length} applicants but only ${selectedBedIds.length} beds`,
        variant: 'destructive',
      });
      return;
    }

    setIsAssigning(true);
    try {
      // Assign each applicant to a bed in order
      const updates = selectedApplicantIds.map((regId, index) => ({
        bedId: selectedBedIds[index],
        registrationId: regId,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('bed_assignments')
          .update({ registration_id: update.registrationId })
          .eq('id', update.bedId);

        if (error) throw error;
      }

      toast({
        title: 'Beds Assigned',
        description: `Successfully assigned ${updates.length} applicant(s) to beds`,
      });

      setSelectedApplicantIds([]);
      setSelectedBedIds([]);
      fetchData();
    } catch (error: any) {
      console.error('Error bulk assigning beds:', error);
      toast({
        title: 'Assignment Failed',
        description: error.message || 'Failed to assign beds',
        variant: 'destructive',
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleUnassignBed = async (bedId: string) => {
    await handleAssignBed(bedId, null);
  };

  const getRoomsForHostel = (hostelId: string) => rooms.filter(r => r.hostel_id === hostelId);
  const getOccupiedBeds = (hostelId: string) => {
    const hostelRoomIds = new Set(getRoomsForHostel(hostelId).map(r => r.id));
    return bedAssignments.filter(b => hostelRoomIds.has(b.room_id) && b.registration_id).length;
  };
  const getTotalBeds = (hostelId: string) => {
    const hostelRoomIds = new Set(getRoomsForHostel(hostelId).map(r => r.id));
    return bedAssignments.filter(b => hostelRoomIds.has(b.room_id)).length;
  };
  const getHostelBedAssignments = (hostelId: string) => {
    const hostelRoomIds = new Set(getRoomsForHostel(hostelId).map(r => r.id));
    return bedAssignments.filter(b => hostelRoomIds.has(b.room_id));
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Hostel Management</h1>
            <p className="text-muted-foreground">Manage hostels, rooms, and bed assignments</p>
          </div>
          <Dialog open={isAddHostelOpen} onOpenChange={setIsAddHostelOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Hostel
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Hostel</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="hostel-name">Hostel Name</Label>
                  <Input
                    id="hostel-name"
                    value={newHostel.name}
                    onChange={(e) => setNewHostel({ ...newHostel, name: e.target.value })}
                    placeholder="Enter hostel name"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="total-rooms">Number of Rooms</Label>
                    <Input
                      id="total-rooms"
                      type="number"
                      min="0"
                      value={newHostel.total_rooms}
                      onChange={(e) => setNewHostel({ ...newHostel, total_rooms: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="beds-per-room">Beds per Room</Label>
                    <Input
                      id="beds-per-room"
                      type="number"
                      min="1"
                      value={newHostel.beds_per_room}
                      onChange={(e) => setNewHostel({ ...newHostel, beds_per_room: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="washrooms">Washrooms</Label>
                    <Input
                      id="washrooms"
                      type="number"
                      min="0"
                      value={newHostel.washrooms}
                      onChange={(e) => setNewHostel({ ...newHostel, washrooms: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <Button onClick={handleAddHostel} className="w-full">
                  Add Hostel
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Hostels</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{hostels.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Rooms</CardTitle>
              <Bed className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{rooms.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assigned / Total Beds</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {bedAssignments.filter(b => b.registration_id).length} / {bedAssignments.length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Hostels List */}
        {hostels.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No hostels configured yet</p>
              <Button className="mt-4" onClick={() => setIsAddHostelOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Hostel
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue={hostels[0]?.id} className="w-full">
            <TabsList className="flex flex-wrap h-auto p-1 mb-4 gap-1">
              {hostels.map((hostel) => (
                <TabsTrigger
                  key={hostel.id}
                  value={hostel.id}
                  className="flex items-center gap-2 px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <Building2 className="h-4 w-4" />
                  <span>{hostel.name}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {hostels.map((hostel) => (
              <TabsContent key={hostel.id} value={hostel.id} className="mt-0">
                <Card className="mb-4">
                  <CardHeader className="flex flex-row items-center justify-between py-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Building2 className="h-5 w-5 text-primary" />
                        {hostel.name}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {getRoomsForHostel(hostel.id).length} rooms • {getOccupiedBeds(hostel.id)}/{getTotalBeds(hostel.id)} beds occupied • {hostel.washrooms} washrooms
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingHostel(hostel);
                          setIsEditHostelOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteHostel(hostel.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </CardHeader>
                </Card>

                {/* Two-panel assignment layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Left: Grouped Applicants */}
                  <GroupedApplicantSelector
                    availableRegistrations={availableRegistrations}
                    assignedRegistrationIds={assignedRegistrationIds}
                    selectedIds={selectedApplicantIds}
                    onSelectionChange={setSelectedApplicantIds}
                    onAssignSelected={handleBulkAssign}
                    isAssigning={isAssigning}
                  />

                  {/* Right: Bed Grid */}
                  <BedAssignmentGrid
                    rooms={getRoomsForHostel(hostel.id)}
                    bedAssignments={getHostelBedAssignments(hostel.id)}
                    selectedBedIds={selectedBedIds}
                    onBedSelectionChange={setSelectedBedIds}
                    onUnassignBed={handleUnassignBed}
                  />
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}

        {/* Edit Hostel Dialog */}
        <Dialog open={isEditHostelOpen} onOpenChange={setIsEditHostelOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Hostel</DialogTitle>
            </DialogHeader>
            {editingHostel && (
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-hostel-name">Hostel Name</Label>
                  <Input
                    id="edit-hostel-name"
                    value={editingHostel.name}
                    onChange={(e) => setEditingHostel({ ...editingHostel, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-washrooms">Washrooms</Label>
                  <Input
                    id="edit-washrooms"
                    type="number"
                    min="0"
                    value={editingHostel.washrooms}
                    onChange={(e) => setEditingHostel({ ...editingHostel, washrooms: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Note: Rooms and beds cannot be edited after creation to preserve assignments.
                </p>
                <Button onClick={handleEditHostel} className="w-full">
                  Save Changes
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminHostelManagement;
