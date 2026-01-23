import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Users, User, Search, CheckCircle2, Bed, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Registration {
  id: string;
  name: string;
  application_id: string;
  parent_application_id: string | null;
  hostel_name: string | null;
}

interface ApplicantGroup {
  primary: Registration;
  members: Registration[];
}

interface GroupedApplicantSelectorProps {
  availableRegistrations: Registration[];
  assignedRegistrationIds: Set<string>;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onAssignSelected: () => void;
  isAssigning: boolean;
}

const GroupedApplicantSelector = ({
  availableRegistrations,
  assignedRegistrationIds,
  selectedIds,
  onSelectionChange,
  onAssignSelected,
  isAssigning,
}: GroupedApplicantSelectorProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Group registrations by primary applicant
  const groupedApplicants = useMemo(() => {
    const groups = new Map<string, ApplicantGroup>();
    const standalone: Registration[] = [];

    // First pass: identify primary applicants
    availableRegistrations.forEach((reg) => {
      if (!reg.parent_application_id) {
        groups.set(reg.application_id, { primary: reg, members: [reg] });
      }
    });

    // Second pass: add secondary attendees to their groups
    availableRegistrations.forEach((reg) => {
      if (reg.parent_application_id) {
        const group = groups.get(reg.parent_application_id);
        if (group) {
          group.members.push(reg);
        } else {
          // Parent not in available list, treat as standalone
          standalone.push(reg);
        }
      }
    });

    // Convert to array and add standalone entries
    const result = Array.from(groups.values());
    standalone.forEach((reg) => {
      result.push({ primary: reg, members: [reg] });
    });

    return result;
  }, [availableRegistrations]);

  // Filter based on search
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groupedApplicants;
    const query = searchQuery.toLowerCase();
    return groupedApplicants.filter((group) =>
      group.members.some(
        (m) =>
          m.name.toLowerCase().includes(query) ||
          m.application_id.toLowerCase().includes(query)
      )
    );
  }, [groupedApplicants, searchQuery]);

  const handleGroupToggle = (group: ApplicantGroup) => {
    const unassignedMembers = group.members.filter(
      (m) => !assignedRegistrationIds.has(m.id)
    );
    const memberIds = unassignedMembers.map((m) => m.id);
    const allSelected = memberIds.every((id) => selectedIds.includes(id));

    if (allSelected) {
      onSelectionChange(selectedIds.filter((id) => !memberIds.includes(id)));
    } else {
      const newIds = [...selectedIds];
      memberIds.forEach((id) => {
        if (!newIds.includes(id)) newIds.push(id);
      });
      onSelectionChange(newIds);
    }
  };

  const handleMemberToggle = (memberId: string) => {
    if (selectedIds.includes(memberId)) {
      onSelectionChange(selectedIds.filter((id) => id !== memberId));
    } else {
      onSelectionChange([...selectedIds, memberId]);
    }
  };

  const isGroupFullySelected = (group: ApplicantGroup) => {
    const unassignedMembers = group.members.filter(
      (m) => !assignedRegistrationIds.has(m.id)
    );
    return (
      unassignedMembers.length > 0 &&
      unassignedMembers.every((m) => selectedIds.includes(m.id))
    );
  };

  const isGroupPartiallySelected = (group: ApplicantGroup) => {
    const unassignedMembers = group.members.filter(
      (m) => !assignedRegistrationIds.has(m.id)
    );
    return (
      unassignedMembers.some((m) => selectedIds.includes(m.id)) &&
      !isGroupFullySelected(group)
    );
  };

  const getUnassignedCount = (group: ApplicantGroup) =>
    group.members.filter((m) => !assignedRegistrationIds.has(m.id)).length;

  const toggleGroupExpanded = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Applicant Groups
          </CardTitle>
          {selectedIds.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {selectedIds.length} selected
            </Badge>
          )}
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
            onFocus={(e) => e.target.select()}
          />
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-[400px] px-4">
          <div className="space-y-3 pb-4">
            {filteredGroups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No unassigned applicants found</p>
              </div>
            ) : (
              filteredGroups.map((group) => {
                const unassignedCount = getUnassignedCount(group);
                const isFullyAssigned = unassignedCount === 0;
                const isExpanded = expandedGroups.has(group.primary.application_id);
                const hasSecondaryMembers = group.members.length > 1;

                return (
                  <Collapsible
                    key={group.primary.application_id}
                    open={isExpanded}
                    onOpenChange={() => hasSecondaryMembers && toggleGroupExpanded(group.primary.application_id)}
                  >
                    <div
                      className={cn(
                        'border rounded-lg overflow-hidden transition-all',
                        isGroupFullySelected(group)
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : isGroupPartiallySelected(group)
                          ? 'border-primary/50 bg-primary/[0.02]'
                          : 'border-border',
                        isFullyAssigned && 'opacity-50'
                      )}
                    >
                      {/* Group Header */}
                      <div className="flex items-center">
                        {hasSecondaryMembers && (
                          <CollapsibleTrigger asChild>
                            <button
                              type="button"
                              className="p-3 hover:bg-accent/50 transition-colors"
                            >
                              <ChevronRight
                                className={cn(
                                  'h-4 w-4 text-muted-foreground transition-transform duration-200',
                                  isExpanded && 'rotate-90'
                                )}
                              />
                            </button>
                          </CollapsibleTrigger>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            !isFullyAssigned && handleGroupToggle(group);
                          }}
                          disabled={isFullyAssigned}
                          className={cn(
                            'flex-1 flex items-center gap-3 p-3 text-left transition-colors',
                            hasSecondaryMembers && 'pl-0',
                            !isFullyAssigned && 'hover:bg-accent/50 cursor-pointer',
                            isFullyAssigned && 'cursor-not-allowed'
                          )}
                        >
                          <div
                            className={cn(
                              'flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center',
                              isGroupFullySelected(group)
                                ? 'bg-primary border-primary text-primary-foreground'
                                : isGroupPartiallySelected(group)
                                ? 'bg-primary/20 border-primary'
                                : 'border-muted-foreground/30'
                            )}
                          >
                            {isGroupFullySelected(group) && (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            )}
                            {isGroupPartiallySelected(group) && (
                              <div className="w-2 h-2 bg-primary rounded-sm" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">
                                {group.primary.name}
                              </span>
                              <Badge variant="outline" className="text-[10px] px-1.5">
                                Primary
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {group.primary.application_id}
                            </div>
                          </div>
                          {group.members.length > 1 && (
                            <Badge variant="secondary" className="text-xs">
                              +{group.members.length - 1}
                            </Badge>
                          )}
                        </button>
                      </div>

                      {/* Group Members (Collapsible) */}
                      {group.members.length > 1 && (
                        <CollapsibleContent>
                          <div className="border-t bg-muted/30 divide-y divide-border/50">
                            {group.members.slice(1).map((member) => {
                              const isAssigned = assignedRegistrationIds.has(member.id);
                              const isSelected = selectedIds.includes(member.id);

                              return (
                                <button
                                  key={member.id}
                                  type="button"
                                  onClick={() =>
                                    !isAssigned && handleMemberToggle(member.id)
                                  }
                                  disabled={isAssigned}
                                  className={cn(
                                    'w-full flex items-center gap-3 py-2 px-3 pl-8 text-left transition-colors',
                                    !isAssigned && 'hover:bg-accent/50 cursor-pointer',
                                    isAssigned && 'cursor-not-allowed opacity-50'
                                  )}
                                >
                                  <div
                                    className={cn(
                                      'flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center',
                                      isSelected
                                        ? 'bg-primary border-primary text-primary-foreground'
                                        : 'border-muted-foreground/30'
                                    )}
                                  >
                                    {isSelected && (
                                      <CheckCircle2 className="h-2.5 w-2.5" />
                                    )}
                                  </div>
                                  <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <span className="text-sm truncate block">
                                      {member.name}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                      {member.application_id}
                                    </span>
                                  </div>
                                  {isAssigned && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] text-green-600 border-green-200 bg-green-50"
                                    >
                                      <Bed className="h-2.5 w-2.5 mr-1" />
                                      Assigned
                                    </Badge>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </CollapsibleContent>
                      )}
                    </div>
                  </Collapsible>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>

      {/* Action Footer */}
      {selectedIds.length > 0 && (
        <div className="border-t p-3 bg-muted/30">
          <Button
            onClick={onAssignSelected}
            disabled={isAssigning}
            className="w-full"
            size="sm"
          >
            <Bed className="h-4 w-4 mr-2" />
            Assign {selectedIds.length} to Selected Beds
          </Button>
        </div>
      )}
    </Card>
  );
};

export default GroupedApplicantSelector;
