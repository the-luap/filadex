# Filadex

Filadex tracks a 3D-printing hobbyist's filament collection: what they own, how
much is left, where it is stored, and which parts of it they choose to show
other people.

This file is a glossary and nothing else. It records what the words mean, not
how anything is built.

## Language

### Spools and products

**Spool**:
One physical reel a user owns, with its own remaining amount, purchase date and
storage location. Stored in the `filaments` table, which is why "filament" is
ambiguous in code and should be avoided when a spool is what is meant.
_Avoid_: Filament (when referring to a single owned reel), Roll, Item

**Filament Type**:
The product identity two spools share when they are the same thing off the
shelf — manufacturer, material, colour and diameter. Belongs to one user;
created on demand the first time that user records a spool of it.
_Avoid_: Product, Variant, SKU

**Declared material**:
The material a spool's Filament Type says it is, written as text by the user
(`filament_types.material`). It is what the user typed, not a reference to
anything.
_Avoid_: Material (unqualified — it is the ambiguity this term exists to remove)

### The catalog

**Catalog Material**:
A named material the system knows properties about — density, and whether it
absorbs moisture. This is the thing a per-material sharing setting points at and
the thing a drying reminder is decided from. A declared material has an effect
only when it resolves to one.
_Avoid_: Material (unqualified), Material type

**Global Catalog**:
The Catalog Materials every user sees, curated by administrators. A material is
in it when it belongs to no particular user.

**Personal Catalog**:
The Catalog Materials belonging to one user, visible only to them. A material
lands here when that user declares one the catalogs do not already have.

**Catalog Request**:
A user's proposal that something be added to the Global Catalog, for an
administrator to approve or reject. It exists so the shared catalog stays
curated rather than accumulating whatever anyone typed.
_Avoid_: Suggestion, Submission

**Resolve**:
To find the Catalog Material a declared material names, ignoring case, checking
the user's Personal Catalog before the Global Catalog. A declared material that
resolves to nothing is the condition this product has historically failed to
tell anyone about.
_Avoid_: Match, Look up

### Sharing

**Sharing Setting**:
One user's decision to make part of their collection publicly visible, either
for a single Catalog Material or globally for the whole collection.
_Avoid_: Share, Visibility, Permission

**Public Collection**:
What an unauthenticated visitor sees at a user's share URL: the spools their
Sharing Settings expose, and nothing else.
_Avoid_: Shared filaments, Public profile

### External catalogs & identification

**Community Catalog**:
A read-only external repository of filament specifications (Open Filament
Database or SpoolmanDB) queried to autofill spool and filament type fields
during entry.
_Avoid_: External database, Global catalog

**Generic Term**:
A common industry word (e.g. "Lab", "Filament", "3D") that similarity matching
ignores when comparing token overlap between a scanned entity and existing
catalog entries. Managed by administrators in settings; without this exclusion,
any two manufacturers sharing a generic word would trigger a false similarity
prompt.
_Avoid_: Stop word, noise word, excluded token

**Barcode**:
A machine-readable code (GTIN, EAN, UPC, or vendor barcode) identifying a
spool or its retail packaging, recorded on the spool.
_Avoid_: QR code (when referring to 1D barcodes), GTIN (when referring to non-standard vendor barcodes)

### Accounts and access

**Self-Registration**:
The public flow where an unauthenticated visitor creates their own user
account, requiring email verification before login.
_Avoid_: Sign up, Public registration, Guest creation

**Admin Provisioning**:
The administrative flow where an administrator directly creates an account,
optionally assigning administrative privileges and setting a temporary password.
_Avoid_: Manual creation, User invite

**Registration Policy**:
The instance-wide setting determining whether Self-Registration is permitted.
_Avoid_: Registration toggle, Sign-up switch

