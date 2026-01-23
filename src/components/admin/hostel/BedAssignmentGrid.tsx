import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bed, User, X, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface BedAssignmentGridProps {
  rooms: Room[];
  bedAssignments: BedAssignment[];
  selectedBedIds: string[];
  onBedSelectionChange: (bedIds: string[]) => void;
  onUnassignBed: (bedId: string) => void;
}

const BedAssignmentGrid = ({
  rooms,
  bedAssignments,
  selectedBedIds,
  onBedSelectionChange,
  onUnassignBed,
}: BedAssignmentGridProps) => {
  const getBedsForRoom = (roomId: string) =>
    bedAssignments.filter((b) => b.room_id === roomId).sort((a, b) => a.bed_number - b.bed_number);

  const handleBedToggle = (bedId: string, isAssigned: boolean) => {
    if (isAssigned) return;
    if (selectedBedIds.includes(bedId)) {
      onBedSelectionChange(selectedBedIds.filter((id) => id !== bedId));
    } else {
      onBedSelectionChange([...selectedBedIds, bedId]);
    }
  };

  const handleSelectAllEmpty = (roomId: string) => {
    const emptyBeds = getBedsForRoom(roomId).filter((b) => !b.registration_id);
    const emptyBedIds = emptyBeds.map((b) => b.id);
    const allSelected = emptyBedIds.every((id) => selectedBedIds.includes(id));

    if (allSelected) {
      onBedSelectionChange(selectedBedIds.filter((id) => !emptyBedIds.includes(id)));
    } else {
      const newIds = [...selectedBedIds];
      emptyBedIds.forEach((id) => {
        if (!newIds.includes(id)) newIds.push(id);
      });
      onBedSelectionChange(newIds);
    }
  };

  const getRoomStats = (roomId: string) => {
    const beds = getBedsForRoom(roomId);
    const occupied = beds.filter((b) => b.registration_id).length;
    const selected = beds.filter((b) => selectedBedIds.includes(b.id)).length;
    return { total: beds.length, occupied, selected };
  };

  if (rooms.length === 0) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent className="text-center py-12">
          <Bed className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No rooms in this hostel</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Bed className="h-4 w-4 text-primary" />
            Room & Bed Layout
          </CardTitle>
          {selectedBedIds.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onBedSelectionChange([])}
              className="text-xs h-7"
            >
              Clear Selection
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-[400px] px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pb-4">
            {rooms.map((room) => {
              const stats = getRoomStats(room.id);
              const beds = getBedsForRoom(room.id);
              const hasEmptyBeds = stats.occupied < stats.total;

              return (
                <div
                  key={room.id}
                  className={cn(
                    'border rounded-lg overflow-hidden',
                    stats.selected > 0 && 'ring-1 ring-primary border-primary'
                  )}
                >
                  {/* Room Header */}
                  <div className="flex items-center justify-between p-2 bg-muted/50 border-b">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">Room {room.room_number}</span>
                      <Badge
                        variant={stats.occupied === stats.total ? 'secondary' : 'outline'}
                        className="text-[10px] px-1.5"
                      >
                        {stats.occupied}/{stats.total}
                      </Badge>
                    </div>
                    {hasEmptyBeds && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] px-2"
                        onClick={() => handleSelectAllEmpty(room.id)}
                      >
                        {beds.filter((b) => !b.registration_id).every((b) =>
                          selectedBedIds.includes(b.id)
                        )
                          ? 'Deselect'
                          : 'Select All'}
                      </Button>
                    )}
                  </div>

                  {/* Beds Grid */}
                  <div className="p-2 grid grid-cols-2 gap-1.5">
                    {beds.map((bed) => {
                      const isAssigned = !!bed.registration_id;
                      const isSelected = selectedBedIds.includes(bed.id);

                      return (
                        <div
                          key={bed.id}
                          onClick={() => handleBedToggle(bed.id, isAssigned)}
                          className={cn(
                            'relative p-2 rounded border text-center transition-all',
                            isAssigned
                              ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                              : isSelected
                              ? 'bg-primary/10 border-primary cursor-pointer ring-1 ring-primary'
                              : 'bg-background border-dashed hover:bg-accent/50 cursor-pointer'
                          )}
                        >
                          {/* Selection Indicator */}
                          {isSelected && !isAssigned && (
                            <div className="absolute top-1 right-1">
                              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                            </div>
                          )}

                          {/* Unassign Button */}
                          {isAssigned && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onUnassignBed(bed.id);
                              }}
                              className="absolute top-1 right-1 p-0.5 rounded-full bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}

                          <div className="flex flex-col items-center gap-1">
                            {isAssigned ? (
                              <>
                                <User className="h-4 w-4 text-green-600 dark:text-green-400" />
                                <span className="text-[10px] font-medium text-green-700 dark:text-green-300 truncate max-w-full">
                                  {bed.registration?.name.split(' ')[0]}
                                </span>
                              </>
                            ) : (
                              <>
                                <Bed className={cn(
                                  'h-4 w-4',
                                  isSelected ? 'text-primary' : 'text-muted-foreground'
                                )} />
                                <span className={cn(
                                  'text-[10px]',
                                  isSelected ? 'text-primary font-medium' : 'text-muted-foreground'
                                )}>
                                  Bed {bed.bed_number}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>

      {/* Selection Summary */}
      {selectedBedIds.length > 0 && (
        <div className="border-t p-3 bg-primary/5">
          <div className="flex items-center justify-center gap-2 text-sm text-primary">
            <CheckCircle2 className="h-4 w-4" />
            <span className="font-medium">{selectedBedIds.length} bed(s) selected</span>
          </div>
        </div>
      )}
    </Card>
  );
};

export default BedAssignmentGrid;
