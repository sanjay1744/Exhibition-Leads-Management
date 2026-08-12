using System;
using System.Linq;
using ExhibitionLeads.Core.Entities;
using Microsoft.EntityFrameworkCore;

namespace ExhibitionLeads.Infrastructure.Data;

public static class DbInitializer
{
    public static void Initialize(AppDbContext dbContext, Func<string, string> passwordHasher)
    {
        // 1. Ensure Database exists
        dbContext.Database.EnsureCreated();

        // 2. If running on SQL Server, execute SQL DDL to create missing tables/columns
        var provider = dbContext.Database.ProviderName;
        if (provider != null && provider.Contains("SqlServer"))
        {
            EnsureSqlServerSchema(dbContext);
        }

        // 3. Seed Users if none exist
        var defaultPasswordHash = passwordHasher("Admin@123");

        if (!dbContext.Users.Any())
        {
            var thalaimalaiUser = new User
            {
                Id = Guid.Parse("11111111-1111-1111-1111-111111111111"),
                FullName = "Thalaimalai",
                Username = "Thalaimalai",
                Email = "thalaimalai@ariyai.com",
                UserGroup = "Naren-Marketing",
                Role = "StallOwner",
                Status = "Active",
                PasswordHash = defaultPasswordHash
            };

            var sanjayUser = new User
            {
                Id = Guid.Parse("22222222-2222-2222-2222-222222222222"),
                FullName = "Sanjay",
                Username = "sanjay",
                Email = "sanjay@ariyai.com",
                UserGroup = "Naren Admin",
                Role = "Admin",
                Status = "Active",
                PasswordHash = defaultPasswordHash
            };

            dbContext.Users.AddRange(thalaimalaiUser, sanjayUser);
            dbContext.SaveChanges();
        }

        // 4. Seed Exhibition if none exist
        Guid defaultExhibitionId = Guid.Parse("44444444-4444-4444-4444-444444444444");
        if (!dbContext.Exhibitions.Any())
        {
            var defaultExhibition = new Exhibition
            {
                Id = defaultExhibitionId,
                Code = "EXH-2026-001",
                Name = "International Industrial TexFair 2026",
                Organizer = "SIMA Trade Association",
                Venue = "Codissia Trade Fair Complex, Coimbatore",
                StartDate = DateTime.UtcNow.Date,
                EndDate = DateTime.UtcNow.Date.AddDays(4),
                DurationDays = 4,
                Description = "Premier South India Industrial & Textile Machinery Expo 2026",
                Status = "Active"
            };
            dbContext.Exhibitions.Add(defaultExhibition);
            dbContext.SaveChanges();
        }

        // 5. Seed Stall if none exist
        var thalaimalaiId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var thalaimalaiUserObj = dbContext.Users.FirstOrDefault(u => u.Id == thalaimalaiId);

        if (!dbContext.Stalls.Any())
        {
            var defaultStall = new Stall
            {
                Id = Guid.Parse("33333333-3333-3333-3333-333333333333"),
                Name = "Stall 01 - Main Exhibition",
                Code = "STL-2026-001",
                ExhibitionId = defaultExhibitionId,
                EventName = "International Industrial TexFair 2026",
                Organizer = "SIMA Trade Association",
                DurationDays = 4,
                StartDate = DateTime.UtcNow.Date,
                EndDate = DateTime.UtcNow.Date.AddDays(4),
                Location = "Codissia Trade Fair Complex, Coimbatore",
                HallNumber = "Hall A",
                BoothNumber = "Booth 12",
                OwnerId = thalaimalaiId,
                OwnerName = thalaimalaiUserObj?.FullName ?? "Thalaimalai",
                Status = "Active"
            };
            dbContext.Stalls.Add(defaultStall);
            if (thalaimalaiUserObj != null)
            {
                thalaimalaiUserObj.AssignedStallId = defaultStall.Id;
            }
            dbContext.SaveChanges();
        }

        // 6. Update any existing Stalls that have null ExhibitionId
        var unlinkedStalls = dbContext.Stalls.Where(s => s.ExhibitionId == null).ToList();
        if (unlinkedStalls.Any())
        {
            foreach (var s in unlinkedStalls)
            {
                s.ExhibitionId = defaultExhibitionId;
            }
            dbContext.SaveChanges();
        }

        // 7. Update any existing Leads that have empty ExhibitionId
        var unlinkedLeads = dbContext.Leads.Where(l => l.ExhibitionId == Guid.Empty).ToList();
        if (unlinkedLeads.Any())
        {
            foreach (var l in unlinkedLeads)
            {
                l.ExhibitionId = defaultExhibitionId;
            }
            dbContext.SaveChanges();
        }
    }

    private static void EnsureSqlServerSchema(AppDbContext dbContext)
    {
        var sql = @"
            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Exhibitions]') AND type in (N'U'))
            BEGIN
                CREATE TABLE [dbo].[Exhibitions] (
                    [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                    [Code] NVARCHAR(450) NOT NULL DEFAULT '',
                    [Name] NVARCHAR(MAX) NOT NULL DEFAULT '',
                    [Organizer] NVARCHAR(MAX) NOT NULL DEFAULT '',
                    [Venue] NVARCHAR(MAX) NOT NULL DEFAULT '',
                    [StartDate] DATETIME2 NULL,
                    [EndDate] DATETIME2 NULL,
                    [DurationDays] INT NOT NULL DEFAULT 3,
                    [Description] NVARCHAR(MAX) NOT NULL DEFAULT '',
                    [Status] NVARCHAR(450) NOT NULL DEFAULT 'Active',
                    [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                );
            END

            IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Exhibitions]') AND type in (N'U'))
               AND NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'IX_Exhibitions_Code' AND object_id = OBJECT_ID(N'[dbo].[Exhibitions]'))
            BEGIN
                CREATE UNIQUE INDEX [IX_Exhibitions_Code] ON [dbo].[Exhibitions]([Code]);
            END

            IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Exhibitions]') AND type in (N'U'))
               AND NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'IX_Exhibitions_Status' AND object_id = OBJECT_ID(N'[dbo].[Exhibitions]'))
            BEGIN
                CREATE INDEX [IX_Exhibitions_Status] ON [dbo].[Exhibitions]([Status]);
            END

            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Stalls]') AND type in (N'U'))
            BEGIN
                CREATE TABLE [dbo].[Stalls] (
                    [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                    [Name] NVARCHAR(MAX) NOT NULL DEFAULT '',
                    [Code] NVARCHAR(450) NOT NULL DEFAULT '',
                    [ExhibitionId] UNIQUEIDENTIFIER NULL,
                    [EventName] NVARCHAR(MAX) NOT NULL DEFAULT '',
                    [Organizer] NVARCHAR(MAX) NOT NULL DEFAULT '',
                    [DurationDays] INT NOT NULL DEFAULT 3,
                    [StartDate] DATETIME2 NULL,
                    [EndDate] DATETIME2 NULL,
                    [Location] NVARCHAR(MAX) NOT NULL DEFAULT '',
                    [HallNumber] NVARCHAR(MAX) NOT NULL DEFAULT '',
                    [BoothNumber] NVARCHAR(MAX) NOT NULL DEFAULT '',
                    [OwnerId] UNIQUEIDENTIFIER NOT NULL,
                    [OwnerName] NVARCHAR(MAX) NOT NULL DEFAULT '',
                    [Status] NVARCHAR(MAX) NOT NULL DEFAULT 'Active',
                    [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                );
            END

            IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Stalls]') AND type in (N'U'))
               AND NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Stalls]') AND name = N'ExhibitionId')
            BEGIN
                ALTER TABLE [dbo].[Stalls] ADD [ExhibitionId] UNIQUEIDENTIFIER NULL;
            END

            IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Stalls]') AND type in (N'U'))
               AND NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'IX_Stalls_ExhibitionId' AND object_id = OBJECT_ID(N'[dbo].[Stalls]'))
            BEGIN
                CREATE INDEX [IX_Stalls_ExhibitionId] ON [dbo].[Stalls]([ExhibitionId]);
            END

            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Leads]') AND type in (N'U'))
            BEGIN
                CREATE TABLE [dbo].[Leads] (
                    [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                    [LeadNumber] NVARCHAR(50) NOT NULL DEFAULT '',
                    [ExhibitionId] UNIQUEIDENTIFIER NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
                    [RepId] UNIQUEIDENTIFIER NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
                    [StallId] UNIQUEIDENTIFIER NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
                    [CapturedByUserId] UNIQUEIDENTIFIER NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
                    [Name] NVARCHAR(200) NOT NULL DEFAULT '',
                    [Company] NVARCHAR(200) NOT NULL DEFAULT '',
                    [Designation] NVARCHAR(150) NULL,
                    [Phone] NVARCHAR(50) NOT NULL DEFAULT '',
                    [Email] NVARCHAR(150) NULL,
                    [Website] NVARCHAR(250) NULL,
                    [Address] NVARCHAR(500) NULL,
                    [CaptureMethod] NVARCHAR(50) NOT NULL DEFAULT 'manual',
                    [PhotoUrl] NVARCHAR(MAX) NULL,
                    [VoiceUrl] NVARCHAR(MAX) NULL,
                    [VoiceNotesTranscript] NVARCHAR(MAX) NULL,
                    [InterestLevel] NVARCHAR(20) NOT NULL DEFAULT 'Warm',
                    [ProductCategory] NVARCHAR(MAX) NOT NULL DEFAULT '[]',
                    [Priority] NVARCHAR(20) NOT NULL DEFAULT 'Medium',
                    [Budget] DECIMAL(18,2) NULL,
                    [PurchaseTimeline] NVARCHAR(100) NULL,
                    [FollowUpDate] DATETIMEOFFSET NULL,
                    [Remarks] NVARCHAR(MAX) NULL,
                    [Status] NVARCHAR(30) NOT NULL DEFAULT 'New',
                    [CreatedAt] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
                    [UpdatedAt] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
                );
            END

            IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Leads]') AND type in (N'U'))
               AND NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Leads]') AND name = N'ExhibitionId')
            BEGIN
                ALTER TABLE [dbo].[Leads] ADD [ExhibitionId] UNIQUEIDENTIFIER NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
            END

            IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Leads]') AND type in (N'U'))
               AND NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'IX_Leads_ExhibitionId' AND object_id = OBJECT_ID(N'[dbo].[Leads]'))
            BEGIN
                CREATE INDEX [IX_Leads_ExhibitionId] ON [dbo].[Leads]([ExhibitionId]);
            END

            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND type in (N'U'))
            BEGIN
                CREATE TABLE [dbo].[Users] (
                    [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                    [FullName] NVARCHAR(MAX) NOT NULL DEFAULT '',
                    [Username] NVARCHAR(450) NOT NULL DEFAULT '',
                    [Email] NVARCHAR(450) NOT NULL DEFAULT '',
                    [PasswordHash] NVARCHAR(MAX) NOT NULL DEFAULT '',
                    [UserGroup] NVARCHAR(MAX) NOT NULL DEFAULT 'Naren-Marketing',
                    [Role] NVARCHAR(MAX) NOT NULL DEFAULT 'Marketing',
                    [AssignedStallId] UNIQUEIDENTIFIER NULL,
                    [Status] NVARCHAR(MAX) NOT NULL DEFAULT 'Active',
                    [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                    [LastLoginAt] DATETIME2 NULL
                );
            END

            IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND type in (N'U'))
               AND NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND name = N'AssignedStallId')
            BEGIN
                ALTER TABLE [dbo].[Users] ADD [AssignedStallId] UNIQUEIDENTIFIER NULL;
            END

            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[SmtpConfigs]') AND type in (N'U'))
            BEGIN
                CREATE TABLE [dbo].[SmtpConfigs] (
                    [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                    [UserId] NVARCHAR(450) NOT NULL DEFAULT 'default',
                    [SmtpHost] NVARCHAR(MAX) NOT NULL DEFAULT 'smtp.gmail.com',
                    [Port] INT NOT NULL DEFAULT 587,
                    [Username] NVARCHAR(MAX) NOT NULL DEFAULT '',
                    [Password] NVARCHAR(MAX) NOT NULL DEFAULT '',
                    [FromName] NVARCHAR(MAX) NOT NULL DEFAULT '',
                    [FromEmail] NVARCHAR(MAX) NOT NULL DEFAULT '',
                    [EnableSsl] BIT NOT NULL DEFAULT 1,
                    [UpdatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                );
            END

            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[NotificationConfigs]') AND type in (N'U'))
            BEGIN
                CREATE TABLE [dbo].[NotificationConfigs] (
                    [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
                    [UserId] NVARCHAR(450) NOT NULL DEFAULT 'default',
                    [EventName] NVARCHAR(MAX) NOT NULL DEFAULT '',
                    [EmailAlert] BIT NOT NULL DEFAULT 1,
                    [InAppAlert] BIT NOT NULL DEFAULT 1,
                    [RecipientRole] NVARCHAR(MAX) NOT NULL DEFAULT 'All',
                    [UpdatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                );
            END
        ";

        dbContext.Database.ExecuteSqlRaw(sql);
    }
}
