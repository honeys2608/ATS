"""
Demo script for testing the passive requirement notification system.
This script can be run to manually test the passive requirement detection and notification creation.
"""

import os
import sys
from datetime import datetime, timedelta

# Add the app directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.db import SessionLocal
from app.models import Requirement, User, SystemNotification, RecruiterActivity
from app.passive_requirement_monitor import PassiveRequirementMonitor
from app.utils import generate_uuid

def create_test_data():
    """Create test requirements and activities for demonstration"""
    print("🔧 Setting up test data...")
    
    db = SessionLocal()
    
    try:
        # Create a test requirement that should be marked as passive
        test_requirement = Requirement(
            id=generate_uuid(),
            requirement_code="TEST-PASSIVE-001",
            title="Test Passive Requirement - Backend Developer",
            client_id="test-client-id",
            status="active",
            skills="Python, FastAPI, SQLAlchemy",
            # Set last activity to 50 hours ago (should trigger passive detection)
            last_activity_at=datetime.utcnow() - timedelta(hours=50),
            activity_status="active",
            passive_notification_sent=False
        )
        
        # Create another requirement that should remain active
        active_requirement = Requirement(
            id=generate_uuid(),
            requirement_code="TEST-ACTIVE-001",
            title="Test Active Requirement - Frontend Developer",
            client_id="test-client-id",
            status="active",
            skills="React, TypeScript, CSS",
            # Set last activity to 2 hours ago (should remain active)
            last_activity_at=datetime.utcnow() - timedelta(hours=2),
            activity_status="active",
            passive_notification_sent=False
        )
        
        db.add(test_requirement)
        db.add(active_requirement)
        
        # Create some recent activity for the test requirement (this should be from >48h ago)
        old_activity = RecruiterActivity(
            id=generate_uuid(),
            recruiter_id="test-recruiter-id",
            requirement_id=test_requirement.id,
            activity_type="view",
            description="Viewed requirement details",
            created_at=datetime.utcnow() - timedelta(hours=51)
        )
        
        # Create recent activity for the active requirement
        recent_activity = RecruiterActivity(
            id=generate_uuid(),
            recruiter_id="test-recruiter-id", 
            requirement_id=active_requirement.id,
            activity_type="candidate_search",
            description="Searched for candidates",
            created_at=datetime.utcnow() - timedelta(hours=1)
        )
        
        db.add(old_activity)
        db.add(recent_activity)
        
        db.commit()
        
        print(f"✅ Created test requirements:")
        print(f"   📋 {test_requirement.requirement_code} - Should become PASSIVE")
        print(f"   📋 {active_requirement.requirement_code} - Should stay ACTIVE")
        
        return test_requirement.id, active_requirement.id
        
    except Exception as e:
        print(f"❌ Failed to create test data: {e}")
        db.rollback()
        raise
    finally:
        db.close()

def run_passive_scan_demo():
    """Run the passive requirement scan and show results"""
    print("\n🔍 Running passive requirement scan...")
    
    try:
        monitor = PassiveRequirementMonitor()
        result = monitor.scan_for_passive_requirements()
        
        print(f"✅ Scan completed successfully!")
        print(f"   📊 Passive requirements detected: {result['passive_requirements']}")
        print(f"   📧 Notifications created: {result['notifications_created']}")
        print(f"   🕐 Scan time: {result['scan_time']}")
        
        return result
        
    except Exception as e:
        print(f"❌ Failed to run passive scan: {e}")
        raise

def check_notifications():
    """Check what notifications were created"""
    print("\n📧 Checking created notifications...")
    
    db = SessionLocal()
    
    try:
        notifications = db.query(SystemNotification).filter(
            SystemNotification.notification_type == "passive_requirement"
        ).all()
        
        print(f"Found {len(notifications)} passive requirement notifications:")
        
        for notif in notifications:
            print(f"   🔔 ID: {notif.id}")
            print(f"      Title: {notif.title}")
            print(f"      Message: {notif.message}")
            print(f"      Priority: {notif.priority}")
            print(f"      Created: {notif.created_at}")
            print(f"      Read: {notif.is_read}")
            
            if notif.requirement:
                print(f"      Requirement: {notif.requirement.requirement_code}")
                print(f"      Activity Status: {notif.requirement.activity_status}")
            
            print()
            
    except Exception as e:
        print(f"❌ Failed to check notifications: {e}")
        raise
    finally:
        db.close()

def check_requirements_status():
    """Check the status of test requirements"""
    print("\n📋 Checking requirements status...")
    
    db = SessionLocal()
    
    try:
        requirements = db.query(Requirement).filter(
            Requirement.requirement_code.like("TEST-%")
        ).all()
        
        for req in requirements:
            hours_since_activity = (datetime.utcnow() - req.last_activity_at).total_seconds() / 3600
            
            print(f"   📄 {req.requirement_code}")
            print(f"      Status: {req.status}")
            print(f"      Activity Status: {req.activity_status}")
            print(f"      Hours since last activity: {hours_since_activity:.1f}")
            print(f"      Last activity: {req.last_activity_at}")
            print()
            
    except Exception as e:
        print(f"❌ Failed to check requirements: {e}")
        raise
    finally:
        db.close()

def cleanup_test_data():
    """Clean up test data"""
    print("\n🧹 Cleaning up test data...")
    
    db = SessionLocal()
    
    try:
        # Delete test notifications
        deleted_notifications = db.query(SystemNotification).filter(
            SystemNotification.notification_type == "passive_requirement"
        ).delete()
        
        # Delete test activities
        deleted_activities = db.query(RecruiterActivity).filter(
            RecruiterActivity.requirement_id.in_(
                db.query(Requirement.id).filter(Requirement.requirement_code.like("TEST-%"))
            )
        ).delete()
        
        # Delete test requirements
        deleted_requirements = db.query(Requirement).filter(
            Requirement.requirement_code.like("TEST-%")
        ).delete()
        
        db.commit()
        
        print(f"   🗑️  Deleted {deleted_requirements} requirements")
        print(f"   🗑️  Deleted {deleted_activities} activities")
        print(f"   🗑️  Deleted {deleted_notifications} notifications")
        
    except Exception as e:
        print(f"❌ Failed to cleanup: {e}")
        db.rollback()
        raise
    finally:
        db.close()

def main():
    """Main demo function"""
    print("🚀 Passive Requirement Monitor Demo")
    print("=" * 50)
    
    try:
        # Step 1: Create test data
        passive_id, active_id = create_test_data()
        
        # Step 2: Check initial status
        check_requirements_status()
        
        # Step 3: Run the passive scan
        scan_result = run_passive_scan_demo()
        
        # Step 4: Check requirements status after scan
        check_requirements_status()
        
        # Step 5: Check created notifications
        check_notifications()
        
        # Step 6: Ask if user wants to clean up
        cleanup_choice = input("\n🤔 Clean up test data? (y/N): ").lower().strip()
        if cleanup_choice == 'y':
            cleanup_test_data()
        else:
            print("ℹ️  Test data left in database for manual inspection")
        
        print("\n✅ Demo completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Demo failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()