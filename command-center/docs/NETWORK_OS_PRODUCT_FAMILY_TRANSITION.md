# BHFOS — Product Family Transition

| Field | Value |
| --- | --- |
| Status | Active — founder ratified 2026-08-22 |
| Date | 2026-08-22 |
| Product line | Network OS |
| Implementation authority | None |
| Ratification evidence | `NETWORK_OS_RELEASE1_SLICE1_FOUNDER_RATIFICATION_PACKET.md` |

## Product family

BHFOS is organized as two independent products:

1. **Partner OS** — the operating system for Service Partners and their internal service-company operations.
2. **Network OS** — the operating system for managed service networks, initially developed for Black Horse Integrated Services (BHIS; blackhorseintegrated.com).

Legacy V1/V2 terminology should not be used as the product identity going forward. Historical files and code may retain legacy names until deliberately migrated.

## Network OS repurposing

The existing BHFOS foundation is being copied and repurposed into Network OS rather than destructively converted. The pre-split source state is preserved separately, and Partner OS retains an independent development line.

Network OS should retain reusable foundations only where they serve the managed-network operating model. Existing service-company assumptions are not automatically authoritative for Network OS.

## Service Partner terminology

Companies that fulfill services through the managed network are **Service Partners**. The collective qualified fulfillment network is the **Service Partner Network**.

Legacy `provider` terminology may remain in historical artifacts and code until deliberately migrated, but new product-language artifacts should use Service Partner terminology.

## Independent operation

Partner OS and Network OS must each remain independently operable.

A Service Partner does not initially need Partner OS to participate in Network OS. Network OS may support low-friction Service Partner participation through separately authorized workflows.

A Partner OS customer does not need Network OS to run its service business.

## Stated integration end state

The stated BHFOS product-family end state is controlled interoperability:

**Network OS → managed work → Partner OS**

**Partner OS → authorized acceptance/status/evidence/completion/financial/exception events → Network OS**

Network OS remains authoritative for the managed customer relationship, service need, network coordination, Service Partner selection, SLA, customer communication, network performance, and managed-service financial state.

Partner OS remains authoritative for the Service Partner's internal customer/business operations, internal scheduling/dispatch, workforce execution, and other Partner OS-owned records.

Integration must use controlled contracts/events and must not require one product to reach directly into the other's internal authoritative data stores.

## Economic option

The architecture should preserve the option for Partner OS to become a preferred or required operating connection for Service Partners participating in Network OS when network maturity, Service Partner value, adoption economics, competitive conditions, and explicit business policy justify it.

Mandatory Partner OS adoption is not a current Network OS architectural dependency or provider-onboarding requirement.

## Network OS initial operating company

BHIS is the initial managed-services operator for Network OS. Multifamily is the initial customer market, with qualification-layer extensibility preserved for ALF/senior living, group homes, commercial/institutional, and government environments.

## Governance next step

Network OS requires its own Product Definition, Decision Register terminology, workflow map, capability disposition, requirements, architecture, and release controls derived from the managed-network operating model.

Partner OS governance should evolve independently from its preserved baseline.
