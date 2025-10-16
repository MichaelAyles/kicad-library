# Legal & Licensing Considerations

## Open Source Hardware Licensing

### OSHWA (Open Source Hardware Association) Overview

The Open Source Hardware Association defines open source hardware and provides certification for projects. Key principles:

1. **Documentation**: Design files must be available in preferred format for making modifications
2. **Scope**: License must allow modifications and derived works
3. **Attribution**: License may require attribution to original creators
4. **No Discrimination**: Cannot restrict who uses the design or for what purpose
5. **Distribution**: Rights apply to everyone who receives the design
6. **Format**: Design files must be in open formats (KiCad S-expressions qualify!)

### Recommended Open Source Hardware Licenses

Based on OSHWA guidelines, we should support these licenses:

#### Copyleft Licenses (Share-Alike)

**1. CERN Open Hardware Licence (OHL)**
- **Versions**: CERN-OHL-S-2.0 (strongly reciprocal), CERN-OHL-W-2.0 (weakly reciprocal)
- **Best for**: Hardware-specific, well-understood in electronics community
- **Requires**: Attribution, share-alike for derivatives
- **Recommendation**: **Primary choice for electronics projects**

**2. TAPR Open Hardware License (OHL) v1.0**
- **Best for**: Alternative hardware-specific license
- **Requires**: Attribution, documentation of changes
- **Status**: Less commonly used than CERN-OHL

**3. GNU General Public License (GPL) v3.0**
- **Best for**: Software/hardware hybrid projects
- **Requires**: Share-alike, attribution
- **Note**: More commonly used for software, but valid for hardware

**4. Creative Commons Attribution-ShareAlike (CC-BY-SA-4.0)**
- **Best for**: General-purpose, easy to understand
- **Requires**: Attribution, share-alike
- **Note**: Not hardware-specific but widely recognized

#### Permissive Licenses

**5. MIT License**
- **Best for**: Maximum freedom for users
- **Requires**: Only attribution (copyright notice)
- **Allows**: Commercial use without sharing modifications

**6. BSD 2-Clause License**
- **Best for**: Similar to MIT, maximum freedom
- **Requires**: Attribution
- **Note**: Very permissive

**7. Creative Commons Attribution (CC-BY-4.0)**
- **Best for**: Documentation and designs
- **Requires**: Attribution only
- **Allows**: Commercial use, no share-alike requirement

**8. Apache License 2.0**
- **Best for**: Patent protection clause
- **Requires**: Attribution
- **Includes**: Express patent grant

### License Selection UX

When uploading a subcircuit, users must select a license:

```typescript
enum License {
  // Copyleft (Strong)
  CERN_OHL_S = "CERN-OHL-S-2.0",
  GPL_V3 = "GPL-3.0",
  CC_BY_SA = "CC-BY-SA-4.0",

  // Copyleft (Weak)
  CERN_OHL_W = "CERN-OHL-W-2.0",

  // Permissive
  MIT = "MIT",
  BSD_2_CLAUSE = "BSD-2-Clause",
  CC_BY = "CC-BY-4.0",
  APACHE_2 = "Apache-2.0",

  // Hardware-specific
  TAPR_OHL = "TAPR-OHL-1.0",
}
```

**UI Design**:
```
┌─────────────────────────────────────┐
│ License Selection                   │
├─────────────────────────────────────┤
│ ○ CERN-OHL-S-2.0 (Recommended)     │
│   Share-alike, hardware-specific    │
│                                     │
│ ○ MIT License                       │
│   Permissive, maximum freedom       │
│                                     │
│ ○ CC-BY-SA-4.0                     │
│   Share-alike, well-known           │
│                                     │
│ ○ More options...                   │
│   [Show all 9 licenses]             │
└─────────────────────────────────────┘

[?] Not sure which license to choose?
    See our License Guide
```

### License Badge Display

Each subcircuit shows its license prominently:

```html
<!-- Example badge -->
<div class="license-badge">
  <img src="/badges/cern-ohl-s.svg" alt="CERN-OHL-S-2.0">
  <span>CERN-OHL-S-2.0</span>
  <a href="/licenses/cern-ohl-s">Learn more</a>
</div>
```

## Attribution Requirements

### What Must Be Attributed

1. **Original Author**: Username/real name
2. **Project Title**: Name of the subcircuit
3. **License**: Which license applies
4. **Source URL**: Link to original on our platform
5. **Modifications** (if required by license): Statement of changes

### Attribution Format

Provide users with copy-paste attribution text:

```
┌────────────────────────────────────────┐
│ Attribution (copy this)                │
├────────────────────────────────────────┤
│ "LM358 Dual Op-Amp Circuit"           │
│ by @johndoe                            │
│ https://kicadlib.io/subcircuits/abc123 │
│ Licensed under CERN-OHL-S-2.0          │
└────────────────────────────────────────┘
```

### Machine-Readable Attribution

Embed license metadata in the S-expression when users copy:

```scheme
(kicad_sch (version 20230121) (generator "KiCad Library Platform")

  ;; Attribution and License Information
  (title "LM358 Dual Op-Amp Circuit")
  (comment 1 "Author: johndoe")
  (comment 2 "Source: https://kicadlib.io/subcircuits/abc123")
  (comment 3 "License: CERN-OHL-S-2.0")
  (comment 4 "Downloaded: 2024-01-15")

  ;; Original subcircuit content follows...
  (lib_symbols ...)
)
```

This embeds attribution directly in the KiCad file so it persists through the design workflow.

## Platform Terms of Service

### User Upload Agreement

When users upload a subcircuit, they must agree to:

```markdown
## Terms of Upload

By uploading this subcircuit, you confirm that:

1. ✓ You are the original creator OR have permission to share this design
2. ✓ The design does not infringe on any patents, copyrights, or trademarks
3. ✓ You grant KiCad Library Platform a license to host and distribute this design
4. ✓ You understand that others may use, modify, and distribute your design under the license you selected
5. ✓ You will not upload malicious, harmful, or illegal content

By submitting, you grant KiCad Library Platform a non-exclusive, worldwide, royalty-free license to:
- Host and store your design
- Display your design to other users
- Allow users to download and copy your design
- Generate preview images and derivatives for display purposes

You retain full copyright and ownership of your design.
```

### Platform License

The **platform itself** (website, code, API) should be open source:

**Recommendation**: MIT License for platform code
- Encourages contributions
- Allows others to run their own instances
- Aligns with open source ethos

### DMCA / Copyright Takedown Policy

Required for US-hosted platforms:

```markdown
## Copyright Infringement Policy

We respect intellectual property rights. If you believe content on our platform infringes your copyright:

1. Send a notice to: dmca@kicadlib.io
2. Include:
   - Your contact information
   - Description of copyrighted work
   - URL of infringing content
   - Statement of good faith belief
   - Statement under penalty of perjury
   - Your physical or electronic signature

We will review and take appropriate action (remove content, disable access, or reject claim).

Counter-Notification: If your content was removed, you may file a counter-notification if you believe the claim was erroneous.
```

### Patent Considerations

**Important**: Hardware designs may be subject to patents separate from copyright.

**Platform Policy**:
```markdown
## Patent Notice

Circuit designs may be subject to patent restrictions beyond copyright.

Users are responsible for:
- Ensuring their designs do not infringe patents
- Obtaining patent licenses if required
- Complying with patent laws in their jurisdiction

KiCad Library Platform provides no patent indemnification. Use designs at your own risk.

Some licenses (e.g., Apache-2.0) include express patent grants. Others (e.g., MIT) do not address patents.
```

## Privacy & Data Protection

### GDPR Compliance (if serving EU users)

**Required Features**:

1. **Data Access**: Users can download all their data
   ```
   GET /api/users/me/export
   Returns: JSON with all user data + subcircuits
   ```

2. **Right to Erasure**: Users can delete their account
   ```
   DELETE /api/users/me
   Options:
   - Delete account only (keep subcircuits, anonymize)
   - Delete account + subcircuits
   ```

3. **Consent**: Clear opt-in for data processing
   ```
   ☐ I agree to the Privacy Policy
   ☐ Send me email updates (optional)
   ```

4. **Privacy Policy**: Clear explanation of:
   - What data we collect (GitHub OAuth data, uploads, analytics)
   - How we use it (hosting designs, displaying profiles)
   - How long we keep it (indefinitely unless deleted)
   - Third parties (GitHub OAuth, hosting provider)

### User Data Collected

Be transparent about data collection:

```markdown
## Data We Collect

### From GitHub OAuth:
- GitHub user ID
- Username
- Email address (if public)
- Avatar URL
- Profile URL

### From Your Activity:
- Uploaded subcircuits (S-expressions, metadata)
- Favorites
- Comments (if enabled)
- Copy events (for analytics)
- IP address (for rate limiting)

### Analytics:
- Page views (anonymized)
- Search queries (anonymized)
- Popular circuits (aggregated)

We do NOT:
- Sell your data
- Share your data with advertisers
- Track you across other websites
```

## Content Moderation

### Prohibited Content

```markdown
## Content Policy

Prohibited uploads include:

1. ❌ Malicious designs (deliberately harmful circuits)
2. ❌ Copyright-infringing designs (without permission)
3. ❌ Designs for illegal devices (weapons, jammers, etc.)
4. ❌ Spam or low-quality bulk uploads
5. ❌ Misleading or fraudulent content
6. ❌ Personal information of others (doxing)

Violations may result in:
- Content removal
- Account suspension
- Permanent ban (for repeated violations)
```

### Reporting System

Allow users to report inappropriate content:

```
┌─────────────────────────────┐
│ Report this subcircuit      │
├─────────────────────────────┤
│ ○ Copyright infringement    │
│ ○ Patent infringement       │
│ ○ Malicious design          │
│ ○ Spam or low-quality       │
│ ○ Other (explain below)     │
│                             │
│ [Text area for details]     │
│                             │
│ [Cancel]  [Submit Report]   │
└─────────────────────────────┘
```

Admin interface to review and act on reports.

## Export Control Considerations

**Note**: Electronics designs may be subject to export control laws (e.g., ITAR in USA, EAR).

**Platform Disclaimer**:
```markdown
## Export Control

Users are responsible for complying with export control laws in their jurisdiction.

Some electronic designs may be subject to:
- International Traffic in Arms Regulations (ITAR)
- Export Administration Regulations (EAR)
- Other national security export controls

Do not upload designs subject to export restrictions unless you have obtained proper authorization.

KiCad Library Platform is a global, public platform. Uploaded designs are accessible worldwide.
```

**Recommendation**: Include in Terms of Service that users must not upload export-controlled designs.

## Trademark Considerations

### Platform Name

**Search for conflicts**:
1. Check USPTO (if US-based)
2. Google search for existing use
3. Check domain availability

**Naming Ideas**:
- KiCad Library (might infringe KiCad trademark)
- Circuit Snippets
- Schematic Share
- SubCircuit Hub
- Open Circuits
- CircuitVault

**Recommendation**: Avoid using "KiCad" in platform name unless officially endorsed. Contact KiCad team for permission.

### Component Manufacturer Trademarks

Users may upload circuits with trademarked component names (e.g., "LM358 Circuit").

**Policy**:
```markdown
## Trademarks

Component names, manufacturer names, and product names are trademarks of their respective owners.

Use of trademarked names for descriptive purposes (e.g., "LM358 Op-Amp Circuit") is permitted under nominative fair use.

Do not use trademarks in a way that:
- Implies endorsement by the trademark owner
- Causes confusion about the source
- Dilutes the trademark

Example:
✓ "LM358 Dual Op-Amp Circuit" (descriptive use)
✓ "Voltage Regulator using LM7805" (descriptive use)
✗ "Official Texas Instruments LM358 Design" (implies endorsement)
```

## License Compatibility

### Compatible License Combinations

When users want to combine subcircuits with different licenses:

```
┌─────────────┬──────┬──────┬────────┬────────┬─────┐
│             │ MIT  │ CERN │ GPL-3  │ CC-BY  │ CC- │
│             │      │ -OHL │        │        │ BY- │
│             │      │ -S   │        │        │ SA  │
├─────────────┼──────┼──────┼────────┼────────┼─────┤
│ MIT         │  ✓   │  ✓   │   ✓    │   ✓    │  ✓  │
│ CERN-OHL-S  │  ✗   │  ✓   │   ✗    │   ✗    │  ✓  │
│ GPL-3       │  ✓   │  ✗   │   ✓    │   ✓    │  ✗  │
│ CC-BY       │  ✓   │  ✓   │   ✓    │   ✓    │  ✓  │
│ CC-BY-SA    │  ✗   │  ✓   │   ✗    │   ✗    │  ✓  │
└─────────────┴──────┴──────┴────────┴────────┴─────┘

✓ = Can combine without restrictions
✗ = Copyleft conflict (derivative must use both licenses)
```

**UI Feature**: Show warning if user favorites circuits with incompatible licenses:

```
⚠️ License Compatibility Warning

You have favorited circuits with incompatible licenses:
- "Power Supply" (CERN-OHL-S)
- "MCU Circuit" (MIT)

Combining these may require releasing derivative under CERN-OHL-S.
Consult license text or legal counsel.
```

## Liability & Disclaimers

### Warranty Disclaimer

**Required for all open source hardware**:

```markdown
## No Warranty

ALL DESIGNS ARE PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND.

We make no warranties that:
- Designs are error-free
- Designs are safe to build or use
- Designs will perform as described
- Designs are suitable for any particular purpose

USE AT YOUR OWN RISK.

Electronics can be dangerous. Improper designs may cause:
- Fire
- Electric shock
- Equipment damage
- Injury or death

Always review designs carefully, consult qualified engineers, and follow safety practices.
```

### Limitation of Liability

```markdown
## Limitation of Liability

To the fullest extent permitted by law, KiCad Library Platform and its contributors are NOT liable for:

- Damages from using designs (direct, indirect, incidental, consequential)
- Loss of data or business
- Personal injury or property damage
- Patent, copyright, or trademark infringement by user-uploaded content

You assume all risk when building or using designs from this platform.
```

## Hosting Legal Entity

### Options

**Option 1: Non-Profit Foundation**
- E.g., registered 501(c)(3) in USA
- Tax-exempt status
- Good for donations
- More complex to set up

**Option 2: For-Profit Company (with open source mission)**
- E.g., LLC or C-Corp
- Can accept investment
- Easier to set up
- Can still operate open source platform

**Option 3: Fiscal Sponsor**
- Operate under existing non-profit (e.g., Software Freedom Conservancy)
- They handle legal/tax
- You focus on platform

**Option 4: Individual (for MVP)**
- Simplest for initial launch
- Higher personal liability
- Harder to scale

**Recommendation**: Start as individual or LLC for MVP, transition to non-profit or established entity once traction is proven.

## Summary & Checklist

### Pre-Launch Legal Checklist

- [ ] **Choose Platform License**: MIT recommended
- [ ] **Support 8+ Hardware Licenses**: CERN-OHL-S, MIT, CC-BY-SA, etc.
- [ ] **Write Terms of Service**: Upload agreement, user responsibilities
- [ ] **Write Privacy Policy**: GDPR-compliant data handling
- [ ] **Implement Attribution**: Auto-generate attribution text
- [ ] **DMCA Policy**: Copyright takedown procedure
- [ ] **Content Policy**: Prohibited content rules
- [ ] **Reporting System**: Allow users to report violations
- [ ] **Export Control Notice**: Warn about restricted designs
- [ ] **Warranty Disclaimer**: "AS IS" no warranty
- [ ] **Liability Limitation**: Limit platform liability
- [ ] **Check Trademark**: Ensure platform name doesn't infringe
- [ ] **Data Export**: GDPR-compliant user data export
- [ ] **Account Deletion**: GDPR-compliant right to erasure

### Recommended Default Settings

1. **Default License Suggestion**: CERN-OHL-S-2.0 (hardware-specific, copyleft)
2. **Platform License**: MIT (for website code)
3. **Require License Selection**: Yes (no upload without choosing)
4. **Attribution Auto-Embed**: Yes (add comments to S-expression)
5. **Privacy-Friendly Analytics**: Use Plausible or self-hosted (not Google Analytics)

### Resources

- **OSHWA**: https://www.oshwa.org/definition/
- **CERN OHL**: https://cern-ohl.web.cern.ch/
- **License Chooser**: https://choosealicense.com/
- **GDPR Compliance**: https://gdpr.eu/checklist/
- **Creative Commons**: https://creativecommons.org/licenses/

---

**Disclaimer**: This document provides general information and is not legal advice. Consult a qualified attorney for legal guidance specific to your situation and jurisdiction.
