import { useState, useEffect, useMemo } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
import { logAdminActivity } from '@/lib/activityLogger';

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
  const { userRole } = useAuth();
  const isSuperadmin = userRole === 'superadmin';
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
  const [activeHostelId, setActiveHostelId] = useState<string | null>(null);
  const [newHostel, setNewHostel] = useState({
    name: '',
    total_rooms: 0,
    beds_per_room: 1,
  });
  const [roomBedCounts, setRoomBedCounts] = useState<number[]>([]);
  const [isUpdatingRooms, setIsUpdatingRooms] = useState(false);

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

  // Set initial active hostel when hostels are loaded
  useEffect(() => {
    if (hostels.length > 0 && !activeHostelId) {
      setActiveHostelId(hostels[0].id);
    }
  }, [hostels, activeHostelId]);

  const handleRoomCountChange = (count: number) => {
    const validCount = Math.max(0, count);
    setNewHostel({ ...newHostel, total_rooms: validCount });
    
    // Adjust roomBedCounts array
    setRoomBedCounts(prev => {
      if (validCount > prev.length) {
        // Add new rooms with default bed count
        return [...prev, ...Array(validCount - prev.length).fill(newHostel.beds_per_room)];
      } else {
        // Trim extra rooms
        return prev.slice(0, validCount);
      }
    });
  };

  const handleDefaultBedsChange = (defaultBeds: number) => {
    const validBeds = Math.max(1, defaultBeds);
    setNewHostel({ ...newHostel, beds_per_room: validBeds });
    // Update all rooms that still have the old default
    setRoomBedCounts(prev => prev.map(() => validBeds));
  };

  const handleRoomBedCountChange = (roomIndex: number, beds: number) => {
    const validBeds = Math.max(1, beds);
    setRoomBedCounts(prev => {
      const updated = [...prev];
      updated[roomIndex] = validBeds;
      return updated;
    });
  };

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
        })
        .select()
        .single();

      if (hostelError) throw hostelError;

      // Create rooms and beds with individual bed counts
      if (newHostel.total_rooms > 0 && roomBedCounts.length > 0) {
        const roomsToCreate = roomBedCounts.map((bedCount, i) => ({
          hostel_id: hostelData.id,
          room_number: `${i + 1}`,
          beds_count: bedCount,
        }));

        const { data: roomsData, error: roomsError } = await supabase
          .from('hostel_rooms')
          .insert(roomsToCreate)
          .select();

        if (roomsError) throw roomsError;

        // Create beds for each room based on individual counts
        const bedsToCreate = roomsData.flatMap((room, index) =>
          Array.from({ length: roomBedCounts[index] }, (_, i) => ({
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
      setNewHostel({ name: '', total_rooms: 0, beds_per_room: 1 });
      setRoomBedCounts([]);
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

  const handleAddRooms = async (count: number) => {
    if (!editingHostel || count <= 0) return;

    setIsUpdatingRooms(true);
    try {
      const existingRooms = getRoomsForHostel(editingHostel.id);
      const maxRoomNumber = existingRooms.length > 0 
        ? Math.max(...existingRooms.map(r => parseInt(r.room_number) || 0))
        : 0;

      const roomsToCreate = Array.from({ length: count }, (_, i) => ({
        hostel_id: editingHostel.id,
        room_number: `${maxRoomNumber + i + 1}`,
        beds_count: editingHostel.beds_per_room,
      }));

      const { data: roomsData, error: roomsError } = await supabase
        .from('hostel_rooms')
        .insert(roomsToCreate)
        .select();

      if (roomsError) throw roomsError;

      // Create beds for each new room
      const bedsToCreate = roomsData.flatMap(room =>
        Array.from({ length: editingHostel.beds_per_room }, (_, i) => ({
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

      // Update total_rooms in hostel
      await supabase
        .from('hostels')
        .update({ total_rooms: existingRooms.length + count })
        .eq('id', editingHostel.id);

      toast({ title: 'Success', description: `Added ${count} room(s) with ${editingHostel.beds_per_room} bed(s) each` });
      fetchData();
    } catch (error: any) {
      console.error('Error adding rooms:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add rooms',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingRooms(false);
    }
  };

  const handleRemoveEmptyRooms = async (count: number) => {
    if (!editingHostel || count <= 0) return;

    setIsUpdatingRooms(true);
    try {
      const hostelRooms = getRoomsForHostel(editingHostel.id);
      const hostelBedAssignments = getHostelBedAssignments(editingHostel.id);
      
      // Find rooms that have no assigned beds
      const emptyRooms = hostelRooms.filter(room => {
        const roomBeds = hostelBedAssignments.filter(b => b.room_id === room.id);
        return roomBeds.every(b => !b.registration_id);
      });

      if (emptyRooms.length === 0) {
        toast({
          title: 'No Empty Rooms',
          description: 'All rooms have assigned beds. Unassign beds first to remove rooms.',
          variant: 'destructive',
        });
        return;
      }

      const roomsToRemove = emptyRooms.slice(0, count);
      
      // Delete beds first, then rooms
      for (const room of roomsToRemove) {
        await supabase
          .from('bed_assignments')
          .delete()
          .eq('room_id', room.id);

        await supabase
          .from('hostel_rooms')
          .delete()
          .eq('id', room.id);
      }

      // Update total_rooms in hostel
      await supabase
        .from('hostels')
        .update({ total_rooms: hostelRooms.length - roomsToRemove.length })
        .eq('id', editingHostel.id);

      toast({ title: 'Success', description: `Removed ${roomsToRemove.length} empty room(s)` });
      fetchData();
    } catch (error: any) {
      console.error('Error removing rooms:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove rooms',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingRooms(false);
    }
  };

  const handleAddBedsToRoom = async (roomId: string, count: number) => {
    if (count <= 0) return;

    setIsUpdatingRooms(true);
    try {
      const room = rooms.find(r => r.id === roomId);
      if (!room) return;

      const existingBeds = bedAssignments.filter(b => b.room_id === roomId);
      const maxBedNumber = existingBeds.length > 0 
        ? Math.max(...existingBeds.map(b => b.bed_number))
        : 0;

      const bedsToCreate = Array.from({ length: count }, (_, i) => ({
        room_id: roomId,
        bed_number: maxBedNumber + i + 1,
      }));

      const { error: bedsError } = await supabase
        .from('bed_assignments')
        .insert(bedsToCreate);

      if (bedsError) throw bedsError;

      // Update beds_count in room
      await supabase
        .from('hostel_rooms')
        .update({ beds_count: existingBeds.length + count })
        .eq('id', roomId);

      toast({ title: 'Success', description: `Added ${count} bed(s) to Room ${room.room_number}` });
      fetchData();
    } catch (error: any) {
      console.error('Error adding beds:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add beds',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingRooms(false);
    }
  };

  const handleRemoveEmptyBeds = async (roomId: string, count: number) => {
    if (count <= 0) return;

    setIsUpdatingRooms(true);
    try {
      const room = rooms.find(r => r.id === roomId);
      if (!room) return;

      const roomBeds = bedAssignments.filter(b => b.room_id === roomId);
      const emptyBeds = roomBeds.filter(b => !b.registration_id);

      if (emptyBeds.length === 0) {
        toast({
          title: 'No Empty Beds',
          description: 'All beds are assigned. Unassign beds first to remove them.',
          variant: 'destructive',
        });
        return;
      }

      const bedsToRemove = emptyBeds.slice(0, count);

      for (const bed of bedsToRemove) {
        await supabase
          .from('bed_assignments')
          .delete()
          .eq('id', bed.id);
      }

      // Update beds_count in room
      await supabase
        .from('hostel_rooms')
        .update({ beds_count: roomBeds.length - bedsToRemove.length })
        .eq('id', roomId);

      toast({ title: 'Success', description: `Removed ${bedsToRemove.length} empty bed(s) from Room ${room.room_number}` });
      fetchData();
    } catch (error: any) {
      console.error('Error removing beds:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove beds',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingRooms(false);
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

    // Get the active hostel name for syncing to registrations
    const activeHostel = hostels.find(h => h.id === activeHostelId);
    const hostelName = activeHostel?.name || null;

    setIsAssigning(true);
    try {
      // Assign each applicant to a bed in order
      const updates = selectedApplicantIds.map((regId, index) => ({
        bedId: selectedBedIds[index],
        registrationId: regId,
      }));

      for (const update of updates) {
        // Update bed assignment
        const { error: bedError } = await supabase
          .from('bed_assignments')
          .update({ registration_id: update.registrationId })
          .eq('id', update.bedId);

        if (bedError) throw bedError;

        // Sync hostel_name to registrations table
        if (hostelName) {
          const { error: regError } = await supabase
            .from('registrations')
            .update({ hostel_name: hostelName })
            .eq('id', update.registrationId);

          if (regError) {
            console.error('Failed to sync hostel_name to registration:', regError);
          }
        }

        // Log bed assignment activity
        const registration = allRegistrations.find(r => r.id === update.registrationId);
        if (registration) {
          await logAdminActivity({
            actionType: 'bed_assignment',
            targetRegistrationId: update.registrationId,
            targetApplicationId: registration.application_id,
            details: { name: registration.name, hostel: hostelName }
          });
        }
      }

      toast({
        title: 'Beds Assigned',
        description: `Successfully assigned ${updates.length} applicant(s) to beds${hostelName ? ` in ${activeHostel?.name}` : ''}`,
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
    const bed = bedAssignments.find(b => b.id === bedId);
    if (bed?.registration) {
      await logAdminActivity({
        actionType: 'bed_unassignment',
        targetRegistrationId: bed.registration.id,
        targetApplicationId: bed.registration.application_id,
        details: { name: bed.registration.name }
      });

      // Clear hostel_name from registration when unassigning
      const { error: regError } = await supabase
        .from('registrations')
        .update({ hostel_name: null })
        .eq('id', bed.registration.id);

      if (regError) {
        console.error('Failed to clear hostel_name from registration:', regError);
      }
    }
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
          {isSuperadmin && (
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="total-rooms">Number of Rooms</Label>
                      <Input
                        id="total-rooms"
                        type="number"
                        min="0"
                        value={newHostel.total_rooms}
                        onChange={(e) => handleRoomCountChange(parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="beds-per-room">Default Beds per Room</Label>
                      <Input
                        id="beds-per-room"
                        type="number"
                        min="1"
                        value={newHostel.beds_per_room}
                        onChange={(e) => handleDefaultBedsChange(parseInt(e.target.value) || 1)}
                      />
                    </div>
                  </div>
                  
                  {/* Individual Room Bed Configuration */}
                  {roomBedCounts.length > 0 && (
                    <div className="space-y-2">
                      <Label>Beds per Room (customize individually)</Label>
                      <div className="max-h-48 overflow-y-auto border rounded-md p-3 space-y-2">
                        {roomBedCounts.map((beds, index) => (
                          <div key={index} className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium min-w-[80px]">Room {index + 1}</span>
                            <Input
                              type="number"
                              min="1"
                              value={beds}
                              onChange={(e) => handleRoomBedCountChange(index, parseInt(e.target.value) || 1)}
                              className="w-24 h-8"
                            />
                            <span className="text-xs text-muted-foreground">bed{beds > 1 ? 's' : ''}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Total beds: {roomBedCounts.reduce((sum, count) => sum + count, 0)}
                      </p>
                    </div>
                  )}
                  
                  <Button onClick={handleAddHostel} className="w-full">
                    Add Hostel
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
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
              {isSuperadmin && (
                <Button className="mt-4" onClick={() => setIsAddHostelOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Hostel
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Tabs 
            value={activeHostelId || hostels[0]?.id} 
            onValueChange={(value) => {
              setActiveHostelId(value);
              // Clear selections when switching hostels
              setSelectedBedIds([]);
            }}
            className="w-full"
          >
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
                        {getRoomsForHostel(hostel.id).length} rooms • {getOccupiedBeds(hostel.id)}/{getTotalBeds(hostel.id)} beds occupied
                      </p>
                    </div>
                    {isSuperadmin && (
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
                    )}
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
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Hostel</DialogTitle>
            </DialogHeader>
            {editingHostel && (
              <div className="space-y-6 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-hostel-name">Hostel Name</Label>
                  <Input
                    id="edit-hostel-name"
                    value={editingHostel.name}
                    onChange={(e) => setEditingHostel({ ...editingHostel, name: e.target.value })}
                  />
                </div>

                {/* Current Stats */}
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-2">Current Configuration</p>
                  <p className="text-sm text-muted-foreground">
                    {getRoomsForHostel(editingHostel.id).length} rooms • {editingHostel.beds_per_room} beds per room • {getTotalBeds(editingHostel.id)} total beds
                  </p>
                </div>

                {/* Room Management */}
                <div className="space-y-3">
                  <Label>Manage Rooms</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddRooms(1)}
                      disabled={isUpdatingRooms}
                    >
                      {isUpdatingRooms ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                      Add 1 Room
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddRooms(5)}
                      disabled={isUpdatingRooms}
                    >
                      Add 5 Rooms
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveEmptyRooms(1)}
                      disabled={isUpdatingRooms}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Remove Empty Room
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    New rooms will have {editingHostel.beds_per_room} bed(s). Only empty rooms can be removed.
                  </p>
                </div>

                {/* Bed Management per Room */}
                <div className="space-y-3">
                  <Label>Manage Beds by Room</Label>
                  <div className="max-h-48 overflow-y-auto border rounded-md">
                    {getRoomsForHostel(editingHostel.id).map((room) => {
                      const roomBeds = bedAssignments.filter(b => b.room_id === room.id);
                      const occupiedBeds = roomBeds.filter(b => b.registration_id).length;
                      return (
                        <div key={room.id} className="flex items-center justify-between p-2 border-b last:border-b-0">
                          <span className="text-sm">
                            Room {room.room_number}: {roomBeds.length} beds ({occupiedBeds} occupied)
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAddBedsToRoom(room.id, 1)}
                              disabled={isUpdatingRooms}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveEmptyBeds(room.id, 1)}
                              disabled={isUpdatingRooms}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    {getRoomsForHostel(editingHostel.id).length === 0 && (
                      <p className="text-sm text-muted-foreground p-4 text-center">No rooms configured</p>
                    )}
                  </div>
                </div>

                <Button onClick={handleEditHostel} className="w-full">
                  Save Name Changes
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
